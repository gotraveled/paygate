import { describe, it, expect } from "vitest";
import {
  writeProviderProfile,
  writeComparison,
  writeArticle,
  ARTICLE_TOPICS,
} from "@/lib/research/write";
import { briefProviderProfile, briefComparison } from "@/lib/research/brief";
import type { ProviderFacts } from "@/lib/research/normalize";

function makeFacts(overrides: Partial<ProviderFacts> = {}): ProviderFacts {
  return {
    id: "p1",
    slug: "testpay",
    name: "TestPay",
    category: "payfac",
    categoryLabel: "Payment Facilitator",
    hq: "US",
    summary: "TestPay is a payment facilitator.",
    suitableFor: "online businesses wanting quick onboarding",
    limitations: undefined,
    registrationRequirement: "a registered business in a supported country",
    ownerResidency: undefined,
    merchantApply: {
      supported: [
        { code: "US", name: "United States", status: "supported", scope: "merchant_apply" },
        { code: "GB", name: "United Kingdom", status: "supported", scope: "merchant_apply" },
      ],
      conditional: [
        { code: "IN", name: "India", status: "conditional", scope: "merchant_apply" },
      ],
      notSupported: [
        { code: "MY", name: "Malaysia", status: "not_supported", scope: "merchant_apply" },
      ],
      unverified: [],
    },
    customerPay: [],
    settlement: [],
    industries: [
      { slug: "saas", name: "SaaS", riskLevel: "standard", status: "supported", statusLabel: "Accepted" },
      { slug: "supplements", name: "Supplements", riskLevel: "high", status: "prohibited", statusLabel: "Prohibited" },
    ],
    pricing: [
      { label: "Online card payments", display: "2.9%", region: "US", conditions: "plus $0.30 fixed", disclosed: true },
      { label: "Enterprise plan", display: "Not publicly disclosed", conditions: "contact sales", disclosed: false },
    ],
    reserves: [
      { kind: "rolling_reserve", summary: "Reserves may apply to higher-risk accounts.", conditions: "set during underwriting" },
    ],
    features: [
      { key: "api", status: "supported" },
      { key: "recurring_billing", status: "supported" },
    ],
    paymentTypes: ["one_time", "recurring"],
    paymentTypeLabels: ["One-time payments", "Recurring / subscriptions"],
    requiredDocs: ["Business registration", "Owner ID"],
    applicationSteps: ["Create account", "Submit verification", "Start processing"],
    pros: ["Fast onboarding"],
    cons: ["Automated risk holds possible"],
    affiliateApproved: false,
    sources: [
      { url: "https://testpay.com/pricing", host: "testpay.com", title: "Pricing", retrievedAt: "2026-10-01T00:00:00Z", active: true },
    ],
    evidenceCoverage: { total: 5, unverified: 3, verified: 2, conflicting: 0, fieldsWithEvidence: ["pricing", "countries"] },
    dataGaps: ["owner residency requirements"],
    lastVerifiedAt: "2026-10-15T00:00:00Z",
    ...overrides,
  };
}

describe("writeProviderProfile", () => {
  const f = makeFacts();
  const out = writeProviderProfile(f);

  it("produces substantive original prose", () => {
    expect(out.body.length).toBeGreaterThan(1500);
    expect(out.title).toContain("TestPay");
  });

  it("states supported and not-supported countries accurately", () => {
    expect(out.body).toMatch(/United States/);
    expect(out.body).toMatch(/United Kingdom/);
    expect(out.body).toMatch(/Malaysia/);
    expect(out.body).toMatch(/cannot apply directly/);
  });

  it("states conditional eligibility without overstating it", () => {
    expect(out.body).toMatch(/India/);
    expect(out.body).toMatch(/conditionally/);
  });

  it("includes only fact-backed numbers", () => {
    expect(out.body).toContain("2.9%");
    expect(out.body).not.toContain("3.5%");
    expect(out.body).not.toMatch(/\b19\d\d\b|\b20\d\d\b fees/i); // no invented year-fees
  });

  it("marks undisclosed pricing as undisclosed", () => {
    expect(out.body).toContain("not publicly disclosed");
  });

  it("discloses data gaps rather than inventing", () => {
    expect(out.body).toMatch(/not public|could not verify|unverified/i);
    expect(out.body).toMatch(/owner residency/i);
  });

  it("cites official sources with retrieval context", () => {
    expect(out.body).toContain("https://testpay.com/pricing");
    expect(out.body).toMatch(/last checked/i);
  });

  it("uses no superlatives or filler", () => {
    expect(out.body).not.toMatch(/\bbest\b|\bcheapest\b|guaranteed|top-rated/i);
    expect(out.body).not.toMatch(/in today's/i);
  });

  it("never invents merchant experiences or ratings", () => {
    expect(out.body).not.toMatch(
      /customers report|users say|reviewed by|merchants (love|trust|choose)|rated \d|★+|trustpilot/i
    );
  });

  it("differs across providers (no template-identical output)", () => {
    const f2 = makeFacts({ id: "p2", slug: "altpay", name: "AltPay", category: "mor", categoryLabel: "Merchant of Record" });
    const out2 = writeProviderProfile(f2);
    // Bodies should diverge meaningfully — different category model text
    const shared = out.body.split(" ").filter((w, i) => out2.body.split(" ")[i] === w).length;
    expect(shared / Math.max(out.body.split(" ").length, 1)).toBeLessThan(0.75);
    expect(out2.body).toMatch(/Merchant of Record/i);
  });
});

describe("briefProviderProfile", () => {
  it("approves providers with a real factual base", () => {
    const b = briefProviderProfile(makeFacts());
    expect(b.go).toBe(true);
    expect(b.uniqueValue.length).toBeGreaterThan(0);
  });

  it("rejects providers with no eligibility or pricing data", () => {
    const empty = makeFacts({
      merchantApply: { supported: [], conditional: [], notSupported: [], unverified: [] },
      pricing: [],
      reserves: [],
      industries: [],
      sources: [],
      evidenceCoverage: { total: 0, unverified: 0, verified: 0, conflicting: 0, fieldsWithEvidence: [] },
    });
    const b = briefProviderProfile(empty);
    expect(b.go).toBe(false);
    expect(b.reasons.some((r) => r.includes("hollow profile"))).toBe(true);
  });
});

describe("briefComparison + writeComparison", () => {
  const stripe = makeFacts();
  const razorpay = makeFacts({
    id: "p2",
    slug: "razorpay",
    name: "Razorpay",
    category: "payment_gateway",
    categoryLabel: "Payment Gateway",
    merchantApply: {
      supported: [{ code: "IN", name: "India", status: "supported", scope: "merchant_apply" }],
      conditional: [],
      notSupported: [
        { code: "US", name: "United States", status: "not_supported", scope: "merchant_apply" },
      ],
      unverified: [],
    },
    pricing: [{ label: "Domestic", display: "2%", disclosed: true }],
    industries: [
      { slug: "saas", name: "SaaS", riskLevel: "standard", status: "supported", statusLabel: "Accepted" },
      { slug: "supplements", name: "Supplements", riskLevel: "high", status: "conditional", statusLabel: "Conditional" },
    ],
    sources: [{ url: "https://razorpay.com/pricing", host: "razorpay.com", active: true }],
  });

  it("approves a comparison with real differences", () => {
    const b = briefComparison(stripe, razorpay);
    expect(b.go).toBe(true);
    expect(b.uniqueValue.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects identical providers", () => {
    const b = briefComparison(stripe, stripe);
    expect(b.go).toBe(false);
  });

  it("writes decision-useful contrast, not concatenated profiles", () => {
    const out = writeComparison(stripe, razorpay);
    expect(out.body).toMatch(/does not|cannot|declines/i);
    expect(out.body).toMatch(/United States/);
    expect(out.body).toMatch(/India/);
    expect(out.body).not.toMatch(/\bbest\b|winner/i);
    expect(out.body).toContain("https://razorpay.com/pricing");
    expect(out.body).toContain("https://testpay.com/pricing");
  });
});

describe("writeArticle", () => {
  it("produces every declared topic", () => {
    for (const t of ARTICLE_TOPICS) {
      const out = writeArticle(t);
      expect(out).not.toBeNull();
      expect(out!.body.length).toBeGreaterThan(1000);
      expect(out!.title.length).toBeGreaterThan(10);
    }
  });

  it("labels illustrative numbers as invented, not provider terms", () => {
    const out = writeArticle("rolling-reserves")!;
    expect(out.body).toMatch(/invented for explanation|not any provider'?s actual terms/i);
    expect(out.body).toContain("$50,000"); // the labeled example figure
    expect(out.body).toMatch(/not financial or legal advice/i);
  });

  it("contains no provider-specific claims", () => {
    const out = writeArticle("interchange-fees")!;
    expect(out.body).not.toMatch(/Stripe|PayPal|Square|Adyen/i);
    expect(out.body).not.toMatch(/\bbest\b|guaranteed/i);
  });

  it("returns null for unknown topics", () => {
    expect(writeArticle("does-not-exist" as never)).toBeNull();
  });
});
