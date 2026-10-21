import type { ProviderCardData } from "@/lib/queries";

/**
 * Eligibility finder logic.
 *
 * Produces an explanation per provider — never a guarantee. Statuses map to
 * scores; anything not "supported" is surfaced as a caveat so users see why a
 * result may or may not work for them.
 */

export interface FinderInput {
  countryCode?: string;
  industrySlug?: string;
  paymentType?: string;
}

export interface MatchResult {
  provider: ProviderCardData;
  score: number; // 0-100
  reasons: string[];
  caveats: string[];
}

const COUNTRY_SCORE: Record<string, number> = {
  supported: 50,
  conditional: 30,
  unverified: 15,
  undisclosed: 10,
  conflicting: 5,
  not_supported: -100,
  outdated: 0,
};

const INDUSTRY_SCORE: Record<string, number> = {
  supported: 40,
  conditional: 25,
  restricted: 10,
  unverified: 12,
  prohibited: -100,
};

export function evaluateProvider(
  p: ProviderCardData,
  input: FinderInput
): MatchResult | null {
  const reasons: string[] = [];
  const caveats: string[] = [];
  let score = 10; // base: published directory entry

  if (input.countryCode) {
    const elig = p.countries.find(
      (c) => c.countryCode === input.countryCode && c.scope === "merchant_apply"
    );
    if (!elig) {
      caveats.push(
        "Merchant application availability in your country is not recorded — confirm with the provider."
      );
    } else {
      const s = COUNTRY_SCORE[elig.status] ?? 0;
      score += s;
      if (s <= -100) return null; // verified not supported
      if (elig.status === "supported")
        reasons.push("Officially accepts merchant applications from your country.");
      else if (elig.status === "conditional")
        reasons.push("Accepts merchants from your country under conditions.");
      else caveats.push(`Country eligibility is ${elig.status}.`);
    }
  }

  if (input.industrySlug) {
    const ind = p.industries.find((i) => i.industry.slug === input.industrySlug);
    if (!ind) {
      caveats.push(
        "Industry acceptance not recorded — check the provider's prohibited-business policy."
      );
    } else {
      const s = INDUSTRY_SCORE[ind.status] ?? 0;
      score += s;
      if (s <= -100) return null; // prohibited
      if (ind.status === "supported")
        reasons.push("Your industry is accepted.");
      else if (ind.status === "conditional" || ind.status === "restricted")
        caveats.push(`Your industry is ${ind.status} — review restrictions.`);
      else caveats.push("Industry acceptance is unverified.");
    }
  }

  if (input.paymentType) {
    const types = Array.isArray(p.paymentTypes)
      ? (p.paymentTypes as string[])
      : [];
    if (types.includes(input.paymentType)) {
      score += 10;
      reasons.push("Supports your required payment type.");
    } else if (types.length > 0) {
      caveats.push("Required payment type is not confirmed.");
    } else {
      caveats.push("Supported payment types are undisclosed.");
    }
  }

  return {
    provider: p,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    caveats,
  };
}

export function findMatches(
  providers: ProviderCardData[],
  input: FinderInput
): MatchResult[] {
  return providers
    .map((p) => evaluateProvider(p, input))
    .filter((r): r is MatchResult => r !== null)
    .sort((a, b) => b.score - a.score);
}
