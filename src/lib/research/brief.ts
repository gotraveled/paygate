import type { ProviderFacts } from "./normalize";

/**
 * Content briefs — an internal plan produced before any prose is written.
 *
 * The brief forces an explicit answer to "why does this page deserve to
 * exist?" If the answer is weak — no distinct intent, too little verified
 * evidence, or the same content already exists — the pipeline records the
 * page as `rejected` instead of publishing thin SEO filler.
 */

export interface ContentBrief {
  type: "provider_profile" | "comparison" | "country_guide" | "industry_guide" | "article" | "report";
  subject: string; // provider slug, pair, country code, etc.
  audience: string;
  intent: string; // the search intent / merchant question this page answers
  uniqueValue: string[]; // what this page adds beyond other pages
  keyEvidence: string[]; // the verified facts it will lean on
  missingInfo: string[]; // gaps to disclose, not fill
  go: boolean;
  reasons: string[]; // why it should/shouldn't be written
}

export function briefProviderProfile(f: ProviderFacts): ContentBrief {
  const reasons: string[] = [];
  const uniqueValue: string[] = [];
  const keyEvidence: string[] = [];
  const missingInfo = [...f.dataGaps];

  const totalCountries =
    f.merchantApply.supported.length +
    f.merchantApply.conditional.length +
    f.merchantApply.notSupported.length;
  if (totalCountries > 0) {
    keyEvidence.push(
      `application eligibility across ${totalCountries} tracked countries`
    );
  }
  if (f.pricing.length > 0) keyEvidence.push("published pricing terms");
  if (f.reserves.length > 0) keyEvidence.push("reserve/payout terms");
  if (f.industries.length > 0)
    keyEvidence.push(`${f.industries.length} industry acceptance records`);

  if (f.merchantApply.notSupported.length > 0)
    uniqueValue.push(
      `explicitly names where merchants CANNOT apply (${f.merchantApply.notSupported
        .map((c) => c.name)
        .slice(0, 3)
        .join(", ")}${f.merchantApply.notSupported.length > 3 ? ", …" : ""})`
    );
  if (f.industries.some((i) => i.status === "prohibited" || i.status === "restricted"))
    uniqueValue.push("documents restricted/prohibited industries with status");
  if (f.dataGaps.length > 0)
    uniqueValue.push("discloses what is not publicly known");
  if (f.category === "high_risk")
    uniqueValue.push("serves merchants declined by mainstream providers");
  if (f.category === "mor")
    uniqueValue.push("explains the Merchant of Record trade-off");

  // Gate: a profile needs at least some verified facts to be worth writing.
  if (totalCountries === 0 && f.pricing.length === 0) {
    reasons.push("no eligibility or pricing records — would produce a hollow profile");
  }
  if (f.evidenceCoverage.verified === 0 && f.sources.length === 0) {
    reasons.push("zero verified evidence and no sources captured");
  }
  if (reasons.length === 0) {
    reasons.push("sufficient factual base for a decision-useful profile");
  }

  return {
    type: "provider_profile",
    subject: f.slug,
    audience: "business owners evaluating payment or formation providers",
    intent: `"${f.name} fees", "${f.name} requirements", "does ${f.name} accept <country>/<industry>"`,
    uniqueValue,
    keyEvidence,
    missingInfo,
    go: reasons.every((r) => r.startsWith("sufficient")),
    reasons,
  };
}

export function briefComparison(
  a: ProviderFacts,
  b: ProviderFacts
): ContentBrief {
  const reasons: string[] = [];
  const dimensions: string[] = [];

  // Only compare where the two providers actually differ — otherwise the
  // page adds nothing beyond two separate profiles.
  const aCountries = new Set(a.merchantApply.supported.map((c) => c.code));
  const bCountries = new Set(b.merchantApply.supported.map((c) => c.code));
  const countryDiff =
    [...aCountries].filter((c) => !bCountries.has(c)).length +
    [...bCountries].filter((c) => !aCountries.has(c)).length;
  if (countryDiff > 0)
    dimensions.push(`merchant eligibility differs in ${countryDiff} countries`);

  const aInd = new Map(a.industries.map((i) => [i.slug, i.status]));
  const bInd = new Map(b.industries.map((i) => [i.slug, i.status]));
  const indDiff = [...aInd.entries()].filter(
    ([slug, st]) => bInd.has(slug) && bInd.get(slug) !== st
  ).length;
  if (indDiff > 0)
    dimensions.push(`industry acceptance differs on ${indDiff} categories`);

  const aFees = a.pricing.filter((p) => p.disclosed).length;
  const bFees = b.pricing.filter((p) => p.disclosed).length;
  if (aFees > 0 || bFees > 0) dimensions.push("published pricing exists to compare");

  if (a.category !== b.category)
    dimensions.push(
      `different service models (${a.categoryLabel} vs ${b.categoryLabel})`
    );

  if (dimensions.length < 2) {
    reasons.push(
      `only ${dimensions.length} meaningful difference(s) found — comparison would restate the two profiles`
    );
  } else {
    reasons.push(`${dimensions.length} meaningful differences to explain`);
  }

  return {
    type: "comparison",
    subject: `${a.slug}-vs-${b.slug}`,
    audience: "merchants shortlisting providers",
    intent: `"${a.name} vs ${b.name}"`,
    uniqueValue: dimensions,
    keyEvidence: [
      ...a.pricing.slice(0, 3).map((p) => `${a.name}: ${p.label}`),
      ...b.pricing.slice(0, 3).map((p) => `${b.name}: ${p.label}`),
    ],
    missingInfo: [
      ...new Set([...a.dataGaps, ...b.dataGaps]),
    ],
    go: dimensions.length >= 2,
    reasons,
  };
}
