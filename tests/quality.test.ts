import { describe, it, expect } from "vitest";
import {
  shingleSimilarity,
  findFiller,
  extractNumericClaims,
  allowedNumbersFromText,
  findUnsupportedNumbers,
  keywordRepetition,
  findNearDuplicates,
  validatePage,
} from "@/lib/research/quality";

describe("shingleSimilarity", () => {
  it("returns ~1 for identical text, ~0 for unrelated", () => {
    const a =
      "Stripe accepts merchant applications from the United States, the United Kingdom, Canada, and Australia with standard online onboarding.";
    expect(shingleSimilarity(a, a)).toBeCloseTo(1);
    const b =
      "Rolling reserves withhold a portion of each settlement to cover future chargebacks and refunds.";
    expect(shingleSimilarity(a, b)).toBeLessThan(0.05);
  });

  it("detects near-paraphrase above random text", () => {
    const orig =
      "Stripe accepts merchant applications from the United States, the United Kingdom, Canada, and Australia with standard onboarding.";
    const copy =
      "Stripe accepts merchant applications from the United States, the United Kingdom, Canada, and Australia with standard onboarding for most businesses.";
    const unrelated =
      "Businesses registered in Malaysia cannot apply directly and should consider Merchant of Record providers instead.";
    expect(shingleSimilarity(orig, copy)).toBeGreaterThan(
      shingleSimilarity(orig, unrelated)
    );
  });

  it("is tolerant of short shared terminology", () => {
    const a = "The provider charges a rolling reserve on payouts.";
    const b = "A rolling reserve is common for high-risk merchants.";
    // shared term but different content — low similarity is fine
    expect(shingleSimilarity(a, b, 8)).toBeLessThan(0.3);
  });
});

describe("findFiller", () => {
  it("flags stock openers and superlatives", () => {
    expect(
      findFiller("In today's digital landscape, Stripe is the best choice.")
    ).toContain("stock opener");
    expect(
      findFiller("In today's digital landscape, Stripe is the best choice.")
    ).toContain("unsubstantiated superlative");
  });
  it("flags false human-authorship claims", () => {
    expect(findFiller("This article was written by our team of editors.")).toContain(
      "false human-authorship claim"
    );
  });
  it("passes plain factual prose", () => {
    expect(
      findFiller(
        "Stripe accepts merchant applications from US businesses. Online card payments cost 2.9% plus a fixed fee."
      )
    ).toHaveLength(0);
  });
});

describe("numeric claims", () => {
  it("extracts percentages, currencies, and day counts", () => {
    const claims = extractNumericClaims(
      "Fees are 2.9% plus $0.30 per transaction; payouts take 2 business days."
    );
    const values = claims.map((c) => c.value.toLowerCase());
    expect(values).toContain("2.9%");
    expect(values.some((v) => v.includes("0.30") || v.includes("$ 0.30"))).toBe(true);
    expect(values.some((v) => v.includes("2 business days"))).toBe(true);
  });

  it("flags figures absent from the fact corpus", () => {
    const allowed = allowedNumbersFromText(["card fee 2.9% plus $0.30"]);
    const bad = findUnsupportedNumbers(
      "Online payments cost 2.9% and payouts arrive in 7 days.",
      allowed
    );
    expect(bad.map((b) => b.value)).toContain("7 days");
    expect(bad.map((b) => b.value)).not.toContain("2.9%");
  });
});

describe("keywordRepetition", () => {
  it("flags stuffed text", () => {
    const body = Array(30).fill("stripe ").join("") + "payment processing.";
    const r = keywordRepetition(body, "stripe");
    expect(r.stuffed).toBe(true);
  });
  it("passes normal mention density", () => {
    const body =
      "Stripe operates as a payment facilitator. " +
      "Word ".repeat(80) +
      "Stripe also offers billing tools.";
    expect(keywordRepetition(body, "stripe").stuffed).toBe(false);
  });
});

describe("findNearDuplicates", () => {
  it("catches a copy and ignores distinct pages", () => {
    const mine =
      "Stripe accepts merchant applications from the United States, the United Kingdom, Canada, and Australia with standard onboarding for most standard businesses.";
    const copy = mine + " Applications are reviewed automatically.";
    const other =
      "Razorpay serves Indian businesses with UPI, cards, and netbanking through a domestic gateway.";
    const dupes = findNearDuplicates(mine, [
      { slug: "copy", body: copy },
      { slug: "other", body: other },
    ]);
    expect(dupes.map((d) => d.slug)).toContain("copy");
    expect(dupes.map((d) => d.slug)).not.toContain("other");
  });
});

describe("validatePage", () => {
  it("ignores figures and superlatives inside the references/citation block", () => {
    // Source page titles are citation metadata, not our claims — a source
    // titled "90-Day 0% Offer" or "Best Payment Solution" must not trip the
    // numeric or superlative checks.
    const body = `${"Solid factual prose about eligibility and terms. ".repeat(60)}

## Official references

- [Supabase delivers its back-end-as-a-service to 150 countries with Stripe](https://example.com/a)
- [Razorpay 90-Day 0% Platform Fee Offer - Terms & Conditions](https://example.com/b)
- [PayU - Best Digital Payment Solutions for Businesses](https://example.com/c)`;
    const report = validatePage({
      title: "Test page title",
      body,
      sources: ["https://example.com/a", "https://example.com/b", "https://example.com/c"],
      factTexts: ["TestPay pricing"],
      otherPages: [],
      minLen: 800,
    });
    const names = report.checks.map((c) => c.name);
    const num = report.checks.find((c) => c.name === "numbers_backed_by_facts")!;
    const fil = report.checks.find((c) => c.name === "no_filler_or_superlatives")!;
    expect(names).toContain("numbers_backed_by_facts");
    expect(num.passed).toBe(true);
    expect(fil.passed).toBe(true);
  });

  const base = {
    title: "Test Provider: fees and eligibility",
    body:
      "Test Provider operates as a payment facilitator.\n\n".repeat(40) +
      "\n\n## Official references\n\n- https://example.com/pricing\n\nSome details are unverified.",
    sources: ["https://example.com/pricing"],
    factTexts: ["fee 2.9%"],
    otherPages: [],
    minLen: 200,
  };

  it("passes a well-formed page", () => {
    const r = validatePage(base);
    expect(r.ok).toBe(true);
  });

  it("blocks pages missing source references", () => {
    const r = validatePage({ ...base, sources: [], body: base.body.replace("## Official references", "## Info") });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "has_sources")?.passed).toBe(false);
  });

  it("blocks invented numbers", () => {
    const r = validatePage({
      ...base,
      body: base.body.replace(
        "## Official references",
        "Fees are 4.5%.\n\n## Official references"
      ),
    });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "numbers_backed_by_facts")?.passed).toBe(false);
  });

  it("blocks near-duplicate pages", () => {
    const r = validatePage({
      ...base,
      selfSlug: "mine",
      otherPages: [{ slug: "twin", body: base.body }],
    });
    expect(r.ok).toBe(false);
  });

  it("blocks superlatives", () => {
    const r = validatePage({
      ...base,
      body: base.body.replace(
        "## Official references",
        "It is the best provider.\n\n## Official references"
      ),
    });
    expect(r.ok).toBe(false);
  });

  it("rejects malformed links", () => {
    const r = validatePage({
      ...base,
      body: base.body + "\n\nSee [this](htp:/broken) and [that](javascript:alert(1)).",
    });
    expect(r.checks.find((c) => c.name === "links_wellformed")?.passed).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("accepts well-formed internal and external links", () => {
    const r = validatePage({
      ...base,
      body:
        base.body +
        "\n\nCompare [Stripe](/providers/stripe) and see [pricing](https://stripe.com/pricing).",
    });
    expect(r.checks.find((c) => c.name === "links_wellformed")?.passed).toBe(true);
  });

  it("flags prose that asserts acceptance of a not_supported country", () => {
    const r = validatePage({
      ...base,
      body: base.body.replace(
        "## Official references",
        "TestPay accepts applications from Cuba and Iran.\n\n## Official references"
      ),
      notSupportedCountries: ["Cuba", "Iran"],
    });
    const c = r.checks.find((x) => x.name === "no_fact_contradictions");
    expect(c?.passed).toBe(false);
    expect(c?.detail).toContain("Cuba");
    expect(r.ok).toBe(false);
  });

  it("does not flag an excluded-country section as a contradiction", () => {
    const r = validatePage({
      ...base,
      body: base.body + "\n\nTestPay does not accept businesses from Cuba.",
      notSupportedCountries: ["Cuba"],
    });
    const c = r.checks.find((x) => x.name === "no_fact_contradictions");
    expect(c?.passed).toBe(true);
  });

  it("requires an affiliate disclosure when the subject has a relationship", () => {
    const withDisclosure = validatePage({
      ...base,
      body: base.body + "\n\nThis page contains affiliate links; we may earn a commission.",
      requireAffiliateDisclosure: true,
    });
    expect(
      withDisclosure.checks.find((c) => c.name === "affiliate_disclosure")?.passed
    ).toBe(true);

    const without = validatePage({
      ...base,
      requireAffiliateDisclosure: true,
    });
    expect(
      without.checks.find((c) => c.name === "affiliate_disclosure")?.passed
    ).toBe(false);
    expect(without.ok).toBe(false);
  });
});
