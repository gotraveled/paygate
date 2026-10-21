/**
 * Quality gate — deterministic originality + evidence checks every draft
 * must pass before it can leave internal statuses.
 *
 * These are warning signals, not plagiarism verdicts: shared terminology
 * ("rolling reserve"), legal names, and short factual phrases legitimately
 * recur. Thresholds are set so only substantial overlap or missing evidence
 * blocks publication, and every failure is explained for human review.
 */

export interface QualityCheck {
  name: string;
  severity: "critical" | "warning";
  passed: boolean;
  detail?: string;
}

export interface QualityReport {
  ok: boolean; // true only if no critical check failed
  checks: QualityCheck[];
}

/* ------------------------------------------------------------------ */
/* text utilities                                                      */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  "a an the and or of to in for on with at by from as is are was were be been it its this that these those you your our we their they he she i not no but if then than so such can will may more most other each which who whom what when where how all any both few own same do does did have has had would could should into out about over under again further once".split(
    " "
  )
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%\.\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Word n-gram shingles of a text. */
export function shingles(text: string, k = 8): Set<string> {
  const tokens = tokenize(text);
  const out = new Set<string>();
  for (let i = 0; i + k <= tokens.length; i++) {
    out.add(tokens.slice(i, i + k).join(" "));
  }
  return out;
}

/** Jaccard similarity over shingles: 0 = unrelated, 1 = identical. */
export function shingleSimilarity(a: string, b: string, k = 8): number {
  const sa = shingles(a, k);
  const sb = shingles(b, k);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const s of sa) if (sb.has(s)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/* ------------------------------------------------------------------ */
/* specific checks                                                     */
/* ------------------------------------------------------------------ */

const FILLER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /in today'?s (digital|fast-paced|modern|ever-changing)/i, label: "stock opener" },
  { re: /in conclusion|to sum up|all things considered/i, label: "filler conclusion" },
  { re: /game[- ]changer|cutting[- ]edge|world[- ]class|seamless(ly)?|revolutionar(y|ies)|best-in-class|top-notch/i, label: "marketing filler" },
  { re: /\b(best|cheapest|#1|top-rated|guaranteed|highest-rated)\b/i, label: "unsubstantiated superlative" },
  { re: /merchants (love|trust|choose) /i, label: "unverifiable sentiment claim" },
  { re: /\d+,\d+\+ (merchants|businesses|users)/i, label: "unverifiable scale claim" },
  { re: /written by our (human )?(team|editors|writers)/i, label: "false human-authorship claim" },
];

export function findFiller(body: string): string[] {
  return FILLER_PATTERNS.filter((p) => p.re.test(body)).map((p) => p.label);
}

/**
 * Extract numeric claims (amounts, %, day counts, dollar figures) that need
 * backing evidence. List markers like "1." and version numbers are ignored.
 */
export function extractNumericClaims(body: string): { value: string; context: string }[] {
  const out: { value: string; context: string }[] = [];
  const re = /(\d+(?:\.\d+)?\s?%)|([$€£₹]\s?\d[\d,]*(?:\.\d+)?)|(\b\d[\d,]*(?:\.\d+)?\s?(?:business days?|days?|months?|years?|countries|currencies|states)\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const value = m[0].trim();
    const start = Math.max(0, m.index - 40);
    out.push({ value, context: body.slice(start, m.index + m[0].length + 10).replace(/\s+/g, " ") });
  }
  return out;
}

/** Numbers allowed in text — built from the underlying facts. */
export function allowedNumbersFromText(sourceTexts: string[]): Set<string> {
  const allowed = new Set<string>();
  for (const t of sourceTexts) {
    const re = /(\d+(?:\.\d+)?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) allowed.add(m[1]);
  }
  return allowed;
}

/** Numeric claims in `body` absent from `allowed` — potential invented figures. */
export function findUnsupportedNumbers(
  body: string,
  allowed: Set<string>
): { value: string; context: string }[] {
  return extractNumericClaims(body).filter(({ value }) => {
    const digits = value.match(/[\d.]+/)?.[0];
    if (!digits) return false;
    return !allowed.has(digits);
  });
}

/** Detects unnatural keyword stuffing: term repeated far beyond useful density. */
export function keywordRepetition(
  body: string,
  term: string
): { count: number; density: number; stuffed: boolean } {
  const words = tokenize(body).length;
  const occurrences = body.toLowerCase().split(term.toLowerCase()).length - 1;
  const density = words > 0 ? occurrences / words : 0;
  return { count: occurrences, density, stuffed: occurrences > 20 && density > 0.04 };
}

/** Near-duplicate detection against other pages' bodies. */
export function findNearDuplicates(
  body: string,
  others: { slug: string; body: string }[],
  threshold = 0.45
): { slug: string; score: number }[] {
  return others
    .map((o) => ({ slug: o.slug, score: shingleSimilarity(body, o.body) }))
    .filter((o) => o.score >= threshold)
    .sort((x, y) => y.score - x.score);
}

/* ------------------------------------------------------------------ */
/* page-level validator                                                */
/* ------------------------------------------------------------------ */

export function validatePage(opts: {
  title: string;
  body: string;
  sources: string[]; // official refs the page claims
  factTexts: string[]; // strings of the normalized facts (for number checking)
  otherPages: { slug: string; body: string }[]; // existing pages for dup check
  selfSlug?: string;
  minLen?: number;
  requireSources?: boolean;
  keywordTerm?: string;
  /** country names recorded as not_supported — must never appear in "accepts" claims */
  notSupportedCountries?: string[];
  /** true when the subject provider has an approved affiliate relationship */
  requireAffiliateDisclosure?: boolean;
}): QualityReport {
  const checks: QualityCheck[] = [];
  const body = opts.body;
  // The references block contains verbatim source-page titles as link text —
  // citation metadata, not our claims. Scanning it produced false "unbacked
  // number" and "superlative" flags (e.g. a source titled "Best Payment
  // Solution" or "90-Day 0% Offer"). Prose checks run on the body up to it.
  const prose = body.split(/\n##\s*(?:Official\s+)?[Rr]eferences/)[0];

  checks.push({
    name: "min_length",
    severity: "critical",
    passed: body.length >= (opts.minLen ?? 800),
    detail: `${body.length} chars`,
  });

  const filler = findFiller(prose);
  checks.push({
    name: "no_filler_or_superlatives",
    severity: "critical",
    passed: filler.length === 0,
    detail: filler.length > 0 ? `found: ${filler.join(", ")}` : undefined,
  });

  checks.push({
    name: "no_placeholders",
    severity: "critical",
    passed: !/(TODO|TBD|XXX|\[insert|lorem ipsum)/i.test(body),
  });

  if (opts.requireSources ?? true) {
    checks.push({
      name: "has_sources",
      severity: "critical",
      passed: opts.sources.length > 0 && /##\s*(Official )?[Rr]eferences/.test(body),
      detail:
        opts.sources.length > 0
          ? undefined
          : "no source references — factual claims would be untraceable",
    });
  }

  // Unsupported numbers — every figure must come from the normalized facts.
  const allowed = allowedNumbersFromText(opts.factTexts);
  const badNums = findUnsupportedNumbers(prose, allowed);
  checks.push({
    name: "numbers_backed_by_facts",
    severity: "critical",
    passed: badNums.length === 0,
    detail:
      badNums.length > 0
        ? `unbacked figure(s): ${badNums.slice(0, 3).map((n) => n.value).join(", ")}`
        : undefined,
  });

  // Link format — every markdown link and bare URL must be well-formed.
  const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)|(https?:\/\/[^\s)\]]+)/g;
  const badLinks: string[] = [];
  for (const m of body.matchAll(LINK_RE)) {
    const url = m[1] ?? m[2] ?? "";
    if (url.startsWith("/") || url.startsWith("#")) continue; // internal path/anchor
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) badLinks.push(url.slice(0, 60));
    } catch {
      badLinks.push(url.slice(0, 60));
    }
  }
  checks.push({
    name: "links_wellformed",
    severity: "critical",
    passed: badLinks.length === 0,
    detail:
      badLinks.length > 0 ? `malformed link(s): ${badLinks.join(", ")}` : undefined,
  });

  // Fact-status contradictions — a country recorded as not_supported must
  // not be described as accepted anywhere in the prose.
  if (opts.notSupportedCountries && opts.notSupportedCountries.length > 0) {
    const contradictions: string[] = [];
    for (const name of opts.notSupportedCountries) {
      const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `(accepts?|supports?|available (?:to|in|for)|welcomes?)\\s+[^.\\n]{0,80}\\b${safe}\\b`,
        "i"
      );
      if (re.test(prose)) contradictions.push(name);
    }
    checks.push({
      name: "no_fact_contradictions",
      severity: "critical",
      passed: contradictions.length === 0,
      detail:
        contradictions.length > 0
          ? `asserts acceptance of: ${contradictions.slice(0, 3).join(", ")}`
          : undefined,
    });
  }

  // Affiliate disclosure — if the provider has an approved relationship, the
  // page must say so. No silent monetization.
  if (opts.requireAffiliateDisclosure) {
    checks.push({
      name: "affiliate_disclosure",
      severity: "critical",
      passed:
        /affiliate|referral|partner link|may (earn|receive) a commission|paid relationship|compensat/i.test(
          body // disclosure may live in a footer after references
        ),
      detail:
        "subject has an approved affiliate relationship but the page carries no disclosure",
    });
  }

  // Near-duplicates within our own site.
  const dupes = findNearDuplicates(
    body,
    opts.otherPages.filter((p) => p.slug !== opts.selfSlug)
  );
  checks.push({
    name: "not_near_duplicate",
    severity: "critical",
    passed: dupes.length === 0,
    detail:
      dupes.length > 0
        ? `similar to ${dupes[0].slug} (${(dupes[0].score * 100).toFixed(0)}%)`
        : undefined,
  });

  // Uncertainty disclosure — a page that pretends total certainty is worse
  // than one with gaps.
  checks.push({
    name: "discloses_uncertainty",
    severity: "warning",
    passed:
      /unverified|not (publicly )?disclosed|could not verify|not verified|unknown|conditional/i.test(
        body
      ),
    detail: "page acknowledges data limits",
  });

  if (opts.keywordTerm) {
    const kr = keywordRepetition(body, opts.keywordTerm);
    checks.push({
      name: "keyword_not_stuffed",
      severity: "warning",
      passed: !kr.stuffed,
      detail: `"${opts.keywordTerm}" x${kr.count} (${(kr.density * 100).toFixed(1)}% of words)`,
    });
  }

  // Source-text similarity is checked separately by the caller via
  // shingleSimilarity on claim text — recorded as warning, not verdict.
  checks.push({
    name: "title_present",
    severity: "critical",
    passed: opts.title.trim().length > 5,
  });

  const ok = checks.every((c) => c.severity !== "critical" || c.passed);
  return { ok, checks };
}
