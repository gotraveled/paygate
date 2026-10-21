import { describe, it, expect } from "vitest";
import { decideCountryAction, capStatus } from "@/lib/research/claimify";
import { detectGeoContext } from "@/lib/research/evidence";

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
