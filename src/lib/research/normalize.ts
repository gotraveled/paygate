import { db } from "@/lib/db";
import { asStringArray } from "@/lib/utils";
import { isEvidencePath } from "./research";
import {
  CATEGORY_LABELS,
  INDUSTRY_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/constants";

/**
 * Layer B — Normalized factual records.
 *
 * Reads the structured DB fields (which the research + verify agents keep
 * current) and the evidence ledger, and produces a single ProviderFacts
 * object. The editorial engine (Layer C) writes prose from THIS — never
 * from raw source HTML or copied paragraphs — so published text is
 * synthesized, not paraphrased.
 *
 * Every fact retains its verification state; the writer is required to
 * render "unknown" and "unverified" honestly rather than fill gaps.
 */

export interface CountryFact {
  code: string;
  name: string;
  status: string;
  scope: string;
  /** true when the claim row links to an evidence record — false = seed value */
  evidenceLinked?: boolean;
}

export interface IndustryFact {
  slug: string;
  name: string;
  riskLevel: string;
  status: string;
  statusLabel: string;
  notes?: string;
}

export interface PricingFact {
  label: string;
  display: string; // e.g. "2.9% + $0.30", "$25/month", "quote-based"
  region?: string;
  conditions?: string;
  disclosed: boolean; // false when no public amount exists
  /** verification status of the underlying PricingTerm row */
  status?: string;
  /** true when the row links to an evidence record — false = seed value */
  evidenceLinked?: boolean;
}

export interface ReserveFact {
  kind: string;
  summary: string;
  percent?: number;
  daysMin?: number;
  daysMax?: number;
  conditions?: string;
}

export interface SourceRef {
  url: string;
  title?: string;
  host: string;
  retrievedAt?: string; // ISO
  active: boolean;
}

export interface ProviderFacts {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  hq?: string;
  summary?: string;
  suitableFor?: string;
  limitations?: string;
  registrationRequirement?: string;
  ownerResidency?: string;

  merchantApply: {
    supported: CountryFact[];
    conditional: CountryFact[];
    notSupported: CountryFact[];
    unverified: CountryFact[];
  };
  customerPay: CountryFact[];
  settlement: CountryFact[];

  industries: IndustryFact[];
  pricing: PricingFact[];
  reserves: ReserveFact[];
  features: { key: string; status: string }[];
  paymentTypes: string[];
  paymentTypeLabels: string[];
  requiredDocs: string[];
  applicationSteps: string[];
  pros: string[];
  cons: string[];

  affiliateApproved: boolean;

  sources: SourceRef[];
  evidenceCoverage: {
    total: number;
    unverified: number;
    verified: number;
    conflicting: number;
    fieldsWithEvidence: string[];
  };
  /** Distinct gaps the writer should surface, not fill. */
  dataGaps: string[];
  lastVerifiedAt?: string;
}

function countryFactToName(c: { country: { name: string } }) {
  return c.country.name;
}

export async function normalizeProvider(
  providerId: string
): Promise<ProviderFacts | null> {
  const p = await db.provider.findUnique({
    where: { id: providerId },
    include: {
      countries: { include: { country: true } },
      industries: { include: { industry: true } },
      pricing: true,
      reserves: true,
      features: true,
      evidence: {
        where: { status: { not: "outdated" } },
        include: { source: true },
        orderBy: { retrievedAt: "desc" },
      },
      sources: true,
      affiliates: true,
    },
  });
  if (!p) return null;

  // Resolve HQ country code to a name for readable prose.
  let hqName: string | undefined;
  if (p.hqCountryCode) {
    const hqCountry = await db.country.findUnique({
      where: { code: p.hqCountryCode },
      select: { name: true },
    });
    hqName = hqCountry?.name ?? p.hqCountryCode;
  }

  const byScope = (scope: string) =>
    p.countries
      .filter((c) => c.scope === scope)
      .map((c) => ({
        code: c.countryCode,
        name: countryFactToName(c),
        status: c.status,
        scope: c.scope,
        evidenceLinked: c.evidenceId != null,
      }));

  const merchant = byScope("merchant_apply");
  const sort = (status: string) => merchant.filter((c) => c.status === status);

  const industries: IndustryFact[] = p.industries.map((i) => ({
    slug: i.industry.slug,
    name: i.industry.name,
    riskLevel: i.industry.riskLevel,
    status: i.status,
    statusLabel:
      INDUSTRY_STATUS_LABELS[i.status as keyof typeof INDUSTRY_STATUS_LABELS] ??
      i.status,
    notes: i.notes ?? undefined,
  }));

  const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: "$", EUR: "\u20AC", GBP: "\u00A3", INR: "\u20B9", NGN: "\u20A6",
    CAD: "CA$", AUD: "A$",
  };

  const pricing: PricingFact[] = p.pricing.map((t) => {
    const hasAmount = t.amountMin != null;
    const amount = hasAmount
      ? t.unit === "percent"
        ? `${t.amountMin}%`
        : `${CURRENCY_SYMBOLS[t.currency ?? ""] ?? `${t.currency ?? "$"} `}${t.amountMin! % 1 !== 0 ? t.amountMin!.toFixed(2) : t.amountMin}`
      : null;
    const per =
      t.unit === "per_month"
        ? "/month"
        : t.unit === "per_transaction"
          ? " per transaction"
          : "";
    // Skip the region tag when the label already carries it.
    const region =
      t.region && !t.label.includes(`(${t.region})`) ? t.region : undefined;
    return {
      label: t.label,
      display: amount ? `${amount}${per}` : "Not publicly disclosed",
      region,
      conditions: t.conditions ?? undefined,
      status: t.status,
      evidenceLinked: t.evidenceId != null,
      disclosed: hasAmount,
    };
  });

  const reserves: ReserveFact[] = p.reserves.map((r) => ({
    kind: r.kind,
    summary: r.summary,
    percent: r.percent ?? undefined,
    daysMin: r.daysMin ?? undefined,
    daysMax: r.daysMax ?? undefined,
    conditions: r.conditions ?? undefined,
  }));

  // References shown to readers should point at authoritative pages — the
  // same page-type gate used during research excludes customer stories,
  // blogs, and partner directories from the citation list.
  const sources: SourceRef[] = [
    ...new Map(
      [
        ...p.sources.map((s) => ({
          url: s.url,
          title: s.title ?? undefined,
          host: s.host,
          retrievedAt: s.lastFetchedAt?.toISOString(),
          active: s.active,
        })),
        ...p.evidence
          .filter((e) => e.source)
          .map((e) => ({
            url: e.source!.url,
            title: e.source!.title ?? undefined,
            host: e.source!.host,
            retrievedAt:
              e.source!.lastFetchedAt?.toISOString() ??
              e.retrievedAt.toISOString(),
            active: e.source!.active,
          })),
      ].map((s) => [s.url, s])
    ).values(),
  ].filter((s) => isEvidencePath(s.url));

  const ev = p.evidence;
  const fieldsWithEvidence = [...new Set(ev.map((e) => e.field))];

  // Assemble the list of things we honestly don't know.
  const dataGaps: string[] = [];
  if (merchant.length === 0)
    dataGaps.push("supported merchant-application countries");
  if (pricing.length === 0) dataGaps.push("published fee schedule");
  else if (!pricing.some((x) => x.disclosed))
    dataGaps.push("exact pricing (quote-only or undisclosed)");
  if (reserves.length === 0)
    dataGaps.push("reserve and payout terms");
  if (!p.ownerResidency) dataGaps.push("owner residency requirements");
  if (!p.registrationRequirement)
    dataGaps.push("entity registration requirements");
  if (p.pricing.length > 0 && !reserves.some((r) => r.kind === "chargeback" || r.kind === "rolling_reserve"))
    dataGaps.push("chargeback and reserve specifics");
  const unverifiedIndustryCount = industries.filter(
    (i) => i.status === "unverified"
  ).length;
  if (unverifiedIndustryCount > 0)
    dataGaps.push(
      `industry acceptance for ${unverifiedIndustryCount} categor${unverifiedIndustryCount === 1 ? "y" : "ies"}`
    );

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    categoryLabel: CATEGORY_LABELS[p.category] ?? p.category,
    hq: hqName ?? p.hqCountryCode ?? undefined,
    summary: p.summary ?? undefined,
    suitableFor: p.suitableFor ?? undefined,
    limitations: p.limitations ?? undefined,
    registrationRequirement: p.registrationRequirement ?? undefined,
    ownerResidency: p.ownerResidency ?? undefined,
    merchantApply: {
      supported: sort("supported"),
      conditional: sort("conditional"),
      notSupported: sort("not_supported"),
      unverified: merchant.filter(
        (c) => !["supported", "conditional", "not_supported"].includes(c.status)
      ),
    },
    customerPay: byScope("customer_pay"),
    settlement: byScope("settlement"),
    industries,
    pricing,
    reserves,
    features: p.features.map((f) => ({ key: f.key, status: f.status })),
    paymentTypes: asStringArray(p.paymentTypes),
    paymentTypeLabels: asStringArray(p.paymentTypes).map(
      (t) => PAYMENT_TYPE_LABELS[t as keyof typeof PAYMENT_TYPE_LABELS] ?? t
    ),
    requiredDocs: asStringArray(p.requiredDocs),
    applicationSteps: asStringArray(p.applicationSteps),
    pros: asStringArray(p.pros),
    cons: asStringArray(p.cons),
    affiliateApproved:
      p.affiliates.some((a) => a.status === "approved") &&
      !!p.affiliateUrl,
    sources,
    evidenceCoverage: {
      total: ev.length,
      unverified: ev.filter((e) => e.status === "unverified").length,
      verified: ev.filter((e) =>
        ["supported", "conditional", "not_supported", "undisclosed"].includes(
          e.status
        )
      ).length,
      conflicting: ev.filter((e) => e.status === "conflicting").length,
      fieldsWithEvidence,
    },
    dataGaps,
    lastVerifiedAt: p.lastVerifiedAt?.toISOString(),
  };
}
