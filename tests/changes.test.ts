import { describe, it, expect } from "vitest";
import { diffValues, severityFor } from "@/lib/research/changes";
import { autoStatus } from "@/lib/research/evidence";

describe("diffValues", () => {
  it("detects changed values", () => {
    expect(diffValues("summary", "a", "b")).toEqual({
      field: "summary",
      oldValue: "a",
      newValue: "b",
    });
  });
  it("returns null for identical values", () => {
    expect(diffValues("summary", "same", "same")).toBeNull();
    expect(diffValues("x", [1, 2], [1, 2])).toBeNull();
  });
  it("detects structural diffs", () => {
    expect(diffValues("types", ["one_time"], ["one_time", "recurring"])).not.toBeNull();
  });
  it("treats undefined and null as equal", () => {
    expect(diffValues("x", undefined, null)).toBeNull();
  });
});

describe("severityFor", () => {
  it("marks commercial fields significant", () => {
    expect(severityFor("pricing")).toBe("significant");
    expect(severityFor("countries.merchant_apply")).toBe("significant");
    expect(severityFor("pricing.domestic")).toBe("significant");
  });
  it("marks cosmetic fields low", () => {
    expect(severityFor("summary")).toBe("low");
    expect(severityFor("logoUrl")).toBe("low");
  });
});

describe("autoStatus", () => {
  it("upgrades strong official evidence", () => {
    expect(
      autoStatus({ officialSource: true, method: "pattern", confidence: 0.8 })
    ).toBe("supported");
  });
  it("keeps weak official evidence unverified", () => {
    expect(
      autoStatus({ officialSource: true, method: "pattern", confidence: 0.5 })
    ).toBe("unverified");
  });
  it("never auto-verifies third-party evidence", () => {
    expect(
      autoStatus({ officialSource: false, method: "third_party", confidence: 0.95 })
    ).toBe("unverified");
  });
});
