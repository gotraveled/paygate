import { describe, it, expect } from "vitest";
import { decideCountryAction, capStatus } from "@/lib/research/claimify";
import { detectGeoContext } from "@/lib/research/evidence";
import {
  isEvidencePath,
  PAYOUT_HEADING,
  POLICY_HEADING,
  GENERIC_HEADING,
} from "@/lib/research/research";

/**
 * Regression tests for the evidence→claims stage. These cover the behaviors
 * the audit flagged as missing: traceable proposals, capped statuses,
 * weak-agreement vs true conflict, and geo/redirect capture.
 */

const proposal = (over: Partial<Parameters<typeof decideCountryAction>[1]> = {}) => ({
  status: "conditional",
  confidence: 0.55,
  reason: "single official availability page; pending corroboration",
  evidenceId: "ev-new",
  ...over,
});

describe("decideCountryAction", () => {
  it("creates a claim linked to its evidence when none exists", () => {
    expect(decideCountryAction(null, proposal())).toBe("created");
  });

  it("refreshes the evidence link when stored and proposed agree", () => {
    expect(
      decideCountryAction(
        { status: "supported", evidenceId: "ev-old" },
        proposal()
      )
    ).toBe("refreshed");
  });

  it("is unchanged when stored and proposed agree and evidence already linked", () => {
    expect(
      decideCountryAction(
        { status: "conditional", evidenceId: "ev-new", confidence: 0.8 },
        proposal()
      )
    ).toBe("unchanged");
  });

  it("does NOT flag weak agreement as a conflict — supported stored vs conditional proposed", () => {
    // Regression: the pre-fix version marked these 'conflicting' and opened
    // review items. A capped proposal consistent with the stored claim is
    // agreement, not contradiction.
    const action = decideCountryAction(
      { status: "supported", evidenceId: "ev-old" },
      proposal()
    );
    expect(action).not.toBe("conflict");
  });

  it("promotes unverified stored status when evidence supports it", () => {
    expect(
      decideCountryAction(
        { status: "unverified", evidenceId: null },
        proposal({ status: "conditional" })
      )
    ).toBe("promoted");
  });

  it("flags a real contradiction as a conflict — never silently overwrites", () => {
    const action = decideCountryAction(
      { status: "supported", evidenceId: "ev-old" },
      proposal({ status: "not_supported", evidenceId: "ev-new" })
    );
    expect(action).toBe("conflict");
  });
});

describe("capStatus", () => {
  it("caps a single-source high-impact claim at conditional", () => {
    expect(capStatus("supported", false, true)).toBe("conditional");
  });
  it("allows supported only when corroborated by >=2 sources", () => {
    expect(capStatus("supported", true, true)).toBe("supported");
  });
  it("does not inflate non-high-impact claims", () => {
    expect(capStatus("supported", false, false)).toBe("supported");
  });
});

describe("detectGeoContext", () => {
  it("detects /in/ path localization", () => {
    expect(detectGeoContext("https://stripe.com/in/pricing")).toBe("path:/in/");
  });
  it("detects ccTLD hosts", () => {
    expect(detectGeoContext("https://payu.co.in/fees")).toBe("tld:.in");
  });
  it("detects regional subdomains", () => {
    expect(detectGeoContext("https://my.payoneer.com/x")).toBe("subdomain:my");
  });
  it("returns undefined for generic .com hosts", () => {
    expect(detectGeoContext("https://stripe.com/pricing")).toBeUndefined();
  });
});

describe("verified-claim protection", () => {
  it("disagreeing evidence on a verified claim yields review_only, never a demotion", () => {
    const action = decideCountryAction(
      { status: "supported", evidenceId: "ev-old", verifiedBy: "local-audit" },
      proposal({ status: "not_supported", evidenceId: "ev-new" })
    );
    expect(action).toBe("review_only");
  });

  it("agreeing evidence on a verified claim still refreshes normally", () => {
    const action = decideCountryAction(
      { status: "supported", evidenceId: "ev-old", verifiedBy: "local-audit" },
      proposal({ evidenceId: "ev-new" })
    );
    expect(action).toBe("refreshed");
  });
});

describe("page-type evidence gate", () => {
  it("excludes blog, news, partner-directory and help paths", () => {
    expect(isEvidencePath("https://razorpay.com/blog/razorpay-partners-with-replit/")).toBe(false);
    expect(isEvidencePath("https://paymentcloudinc.com/partners/directory/ERCGuaranteed/")).toBe(false);
    expect(isEvidencePath("https://squareup.com/us/en/news/x")).toBe(false);
    expect(isEvidencePath("https://help.stripe.com/questions/x")).toBe(false);
  });
  it("keeps pricing, legal, and availability pages", () => {
    expect(isEvidencePath("https://stripe.com/pricing")).toBe(true);
    expect(isEvidencePath("https://stripe.com/global")).toBe(true);
    expect(isEvidencePath("https://stripe.com/legal/restricted-businesses")).toBe(true);
  });
});

describe("heading filters", () => {
  it("payout headings reject legal boilerplate matches", () => {
    expect(PAYOUT_HEADING.test("Withdrawal of Consent for Electronic Communications")).toBe(false);
    expect(PAYOUT_HEADING.test("we reserve the right to charge")).toBe(false);
    expect(PAYOUT_HEADING.test("When do I get paid?")).toBe(true);
    expect(PAYOUT_HEADING.test("Rolling reserve policy")).toBe(true);
    expect(PAYOUT_HEADING.test("Settlement timing")).toBe(true);
  });
  it("policy headings match real policy sections", () => {
    expect(POLICY_HEADING.test("Prohibited businesses")).toBe(true);
    expect(POLICY_HEADING.test("Acceptable use")).toBe(true);
    expect(POLICY_HEADING.test("Thank you for submitting the details")).toBe(false);
  });
  it("generic legal-structure headings are rejected as policy", () => {
    expect(GENERIC_HEADING.test("1 Definitions and Interpretation")).toBe(true);
    expect(GENERIC_HEADING.test("15. Dormant accounts")).toBe(true);
    expect(GENERIC_HEADING.test("25. Withdrawal of Consent")).toBe(true);
    expect(GENERIC_HEADING.test("Prohibited business categories")).toBe(false);
  });
});
