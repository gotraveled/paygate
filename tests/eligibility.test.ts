import { describe, it, expect } from "vitest";
import { evaluateProvider, findMatches } from "@/lib/eligibility";
import type { ProviderCardData } from "@/lib/queries";

function makeProvider(
  overrides: Partial<ProviderCardData> = {}
): ProviderCardData {
  return {
    id: "p1",
    slug: "test-provider",
    name: "Test Provider",
    normalizedName: "test provider",
    websiteUrl: "https://example.com",
    domain: "example.com",
    logoUrl: null,
    category: "payfac",
    vertical: "payments",
    hqCountryCode: "US",
    summary: "A provider",
    suitableFor: null,
    status: "published",
    sponsored: false,
    affiliateUrl: null,
    registrationRequirement: null,
    ownerResidency: null,
    paymentTypes: ["one_time", "recurring"],
    applicationSteps: null,
    requiredDocs: null,
    pros: null,
    cons: null,
    limitations: null,
    lastVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    countries: [
      {
        id: "e1",
        providerId: "p1",
        countryCode: "US",
        scope: "merchant_apply",
        status: "supported",
        notes: null,
        evidenceId: null,
        statusReason: null,
        confidence: null,
        country: { code: "US", name: "United States", region: null, intro: null, active: true, createdAt: new Date() },
      },
    ],
    industries: [
      {
        id: "i1",
        providerId: "p1",
        industryId: "ind1",
        status: "supported",
        evidenceId: null,
        statusReason: null,
        confidence: null,
        notes: null,
        industry: { id: "ind1", slug: "saas", name: "SaaS & Software", vertical: "payments", summary: null, riskLevel: "standard", createdAt: new Date() },
      },
    ],
    pricing: [],
    ...overrides,
  };
}

describe("evaluateProvider", () => {
  it("scores strong matches highly with reasons", () => {
    const r = evaluateProvider(makeProvider(), {
      countryCode: "US",
      industrySlug: "saas",
      paymentType: "recurring",
    });
    expect(r).not.toBeNull();
    expect(r!.score).toBeGreaterThanOrEqual(80);
    expect(r!.reasons.length).toBeGreaterThanOrEqual(3);
    expect(r!.caveats).toHaveLength(0);
  });

  it("rejects providers verified as not supported in the country", () => {
    const p = makeProvider({
      countries: [
        { ...makeProvider().countries[0], status: "not_supported" },
      ],
    });
    expect(evaluateProvider(p, { countryCode: "US" })).toBeNull();
  });

  it("rejects providers prohibiting the industry", () => {
    const p = makeProvider({
      industries: [
        { ...makeProvider().industries[0], status: "prohibited" },
      ],
    });
    expect(evaluateProvider(p, { industrySlug: "saas" })).toBeNull();
  });

  it("adds caveats when data is missing rather than assuming", () => {
    const p = makeProvider({ countries: [], industries: [] });
    const r = evaluateProvider(p, {
      countryCode: "US",
      industrySlug: "saas",
    });
    expect(r).not.toBeNull();
    expect(r!.caveats.length).toBeGreaterThanOrEqual(2);
    expect(r!.score).toBeLessThan(50);
  });

  it("treats conditional country as a positive-but-caveated match", () => {
    const p = makeProvider({
      countries: [{ ...makeProvider().countries[0], status: "conditional" }],
    });
    const r = evaluateProvider(p, { countryCode: "US" });
    expect(r!.score).toBeGreaterThan(20);
    expect(r!.reasons.some((x) => /conditions/i.test(x))).toBe(true);
  });
});

describe("findMatches", () => {
  it("sorts by score descending and excludes hard failures", () => {
    const good = makeProvider({ id: "good", slug: "good" });
    const bad = makeProvider({
      id: "bad",
      slug: "bad",
      countries: [{ ...makeProvider().countries[0], status: "not_supported" }],
    });
    const unknown = makeProvider({ id: "unk", slug: "unk", countries: [] });
    const results = findMatches([bad, unknown, good], { countryCode: "US" });
    expect(results.map((r) => r.provider.id)).toEqual(["good", "unk"]);
  });
});
