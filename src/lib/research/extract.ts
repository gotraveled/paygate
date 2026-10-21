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

export function extractPage(html: string, baseUrl: string): ExtractedPage {
  const $ = cheerio.load(html);
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

export function findCountryMentions(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(ISO2.source, "g");
  while ((m = re.exec(text))) found.add(m[1]);
  return [...found];
}
