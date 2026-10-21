import * as cheerio from "cheerio";

/**
 * Turn a fetched HTML page into research artifacts:
 * title, main text, outbound links, and keyword-targeted sections.
 */

export interface ExtractedPage {
  title: string;
  text: string;
  links: { href: string; text: string }[];
  sections: { heading: string; text: string }[];
}

const KEYWORDS: Record<string, RegExp> = {
  pricing: /pric(e|ing)|fees?|rates?|cost/i,
  countries: /countr(y|ies)|supported regions?|availab|locations?|global/i,
  prohibited: /prohibit|restrict|high.?risk|accept(ed|able) (use|business)|banned|not (supported|permitted)|ineligible/i,
  payouts: /payout|settle|withdraw|rolling reserve|reserve/i,
  integration: /api|integrat|plugin|sdk|developer/i,
  affiliate: /affiliate|partner|referral|reseller/i,
  application: /apply|sign.?up|onboard|underwrit|approval|requirements?/i,
};

/** Recursively collect human-readable strings from a parsed JSON blob. */
function stringsFromJson(node: unknown, out: string[], depth = 0): void {
  if (depth > 8 || out.length > 400) return;
  if (typeof node === "string") {
    // Keep real sentences, not class names, keys, hex blobs, or URLs.
    if (node.length >= 40 && /[a-z]{3} [a-z]{3}/.test(node) && !/^https?:|^\/\//.test(node)) {
      out.push(node);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const n of node) stringsFromJson(n, out, depth + 1);
    return;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      stringsFromJson(v, out, depth + 1);
    }
  }
}

/**
 * JS-rendered fallback: pages like Paddle's pricing ship their content inside
 * <script type="application/ld+json"> or framework blobs (__NEXT_DATA__) and
 * render it client-side, leaving the DOM body nearly empty. When the rendered
 * text is thin we mine those blobs for real strings and expose them as a
 * pseudo-section so downstream keyword extraction still works — with the
 * heading marked so consumers know the provenance is structured data.
 */
function embeddedDataSections($: cheerio.CheerioAPI): { heading: string; text: string }[] {
  const strings: string[] = [];
  $('script[type="application/ld+json"], script#__NEXT_DATA__, script#__NUXT_DATA__').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw || raw.length < 20) return;
    try {
      stringsFromJson(JSON.parse(raw), strings);
    } catch {
      /* malformed embedded JSON — skip, not evidence */
    }
  });
  if (strings.length === 0) return [];
  const text = strings.join(" ").replace(/\s+/g, " ").slice(0, 15000);
  return [{ heading: "Embedded structured data (JSON-LD/hydration)", text }];
}

export function extractPage(html: string, baseUrl: string): ExtractedPage {
  const $ = cheerio.load(html);
  const embedded = embeddedDataSections($);
  $("script, style, noscript, svg").remove();

  const title =
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    new URL(baseUrl).hostname;

  // Collect sections by heading keywords
  const sections: { heading: string; text: string }[] = [];
  $("h1, h2, h3, h4").each((_, el) => {
    const heading = $(el).text().trim();
    if (!heading || heading.length > 160) return;
    // Grab sibling text until the next heading of same/higher level
    const texts: string[] = [];
    let node = el.nextSibling;
    let hops = 0;
    while (node && hops < 40) {
      const $node = $(node);
      const el = $node.get(0);
      if (el && el.type === "tag" && /^H[1-4]$/i.test(el.name)) break;
      const t = $node.text().trim();
      if (t) texts.push(t);
      node = node.nextSibling;
      hops++;
    }
    const text = texts.join(" ").replace(/\s+/g, " ").slice(0, 3000);
    if (text) sections.push({ heading, text });
  });

  const links: { href: string; text: string }[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      const text = $(el).text().trim().slice(0, 120);
      links.push({ href: abs, text });
    } catch {
      /* skip bad urls */
    }
  });

  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 20000);

  // Thin rendered body → hydrate from embedded structured data.
  if (text.length < 800 && embedded.length > 0) {
    sections.push(...embedded);
    return {
      title,
      text: `${text} ${embedded[0].text}`.trim().slice(0, 20000),
      links,
      sections,
    };
  }

  return { title, text, links, sections };
}

/** Sections whose heading or text matches a named keyword bucket. */
export function sectionsFor(
  page: ExtractedPage,
  bucket: keyof typeof KEYWORDS
): { heading: string; text: string }[] {
  const re = KEYWORDS[bucket];
  return page.sections.filter(
    (s) => re.test(s.heading) || re.test(s.text.slice(0, 300))
  );
}

/** Internal links on the same host likely to hold target documentation. */
export function relevantInternalLinks(
  page: ExtractedPage,
  baseUrl: string
): string[] {
  const host = new URL(baseUrl).hostname.replace(/^www\./, "");
  const seen = new Set<string>();
  const out: string[] = [];
  const interesting =
    /pricing|fees?|countries|supported|prohibit|restrict|payout|reserve|settle|affiliate|partner|referral|docs?|terms|legal|apply|onboard/i;
  for (const l of page.links) {
    try {
      const u = new URL(l.href);
      const h = u.hostname.replace(/^www\./, "");
      if (h !== host) continue;
      if (!interesting.test(u.pathname) && !interesting.test(l.text)) continue;
      const clean = u.origin + u.pathname;
      if (seen.has(clean)) continue;
      seen.add(clean);
      out.push(l.href);
    } catch {
      /* skip */
    }
  }
  return out.slice(0, 30);
}

/** Find affiliate/partner program links anywhere on the page. */
export function affiliateLinks(page: ExtractedPage): string[] {
  const re = /affiliate|partner|referral|reseller/i;
  const out = new Set<string>();
  for (const l of page.links) {
    if (re.test(l.href) || re.test(l.text)) out.add(l.href);
  }
  return [...out];
}

/**
 * Crude fee extraction: finds "x.y% + $c" style published pricing.
 * Requires fee/currency context in the surrounding text — bare percentages
 * ("45% win rate", "99.9% uptime") are not fee signals and are discarded.
 */
const FEE_CONTEXT =
  /[$€£₹¢]|\b(?:USD|EUR|GBP|INR|CAD|AUD|NZD|SGD|JPY|cents?)\b|fees?|charges?|commission|per (?:transaction|txn|charge)|discount rate|interchange/i;

export function findFeeMentions(text: string): string[] {
  const re =
    /(\d+(?:\.\d+)?)\s*%\s*(?:\+\s*[A-Z]{0,3}\$?\s?\d+(?:\.\d+)?\s*(?:¢|cents?|[A-Z]{3})?)?/g;
  const matches = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && matches.size < 10) {
    const idx = m.index;
    const ctx = text.slice(Math.max(0, idx - 60), idx + 80).trim();
    if (!FEE_CONTEXT.test(ctx)) continue;
    matches.add(ctx);
  }
  return [...matches];
}

/** Country mentions for supported-country extraction. */
export const ISO2 = /\b(US|GB|IN|CA|AU|MY|SG|DE|FR|NL|ES|IT|IE|SE|NO|DK|FI|BE|AT|CH|PL|PT|GR|CZ|HU|RO|BG|HR|SK|SI|EE|LV|LT|LU|MT|CY|JP|HK|NZ|ZA|AE|BR|MX|ID|TH|PH|VN|KR|TW|IL|SA|TR|AR|CL|CO|KE|NG|GH|EG|PK|BD|LK)\b/g;

/**
 * Availability pages almost always spell out country NAMES ("Australia",
 * "United Kingdom") rather than ISO codes. Pass the directory's own
 * name→code map (db.country) so real availability lists produce codes.
 */
export function findCountryMentions(
  text: string,
  nameToCode?: Record<string, string>
): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(ISO2)) found.add(m[1]);
  if (nameToCode) {
    const lower = text.toLowerCase();
    for (const [name, code] of Object.entries(nameToCode)) {
      // word-boundary-ish check on the lowercase name
      const idx = lower.indexOf(name);
      if (idx === -1) continue;
      const before = idx === 0 ? " " : lower[idx - 1];
      const after = idx + name.length >= lower.length ? " " : lower[idx + name.length];
      if (!/[a-z]/i.test(before) && !/[a-z]/i.test(after)) found.add(code);
    }
  }
  return [...found];
}
