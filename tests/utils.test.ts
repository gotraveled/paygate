import { describe, it, expect } from "vitest";
import {
  slugify,
  normalizeProviderName,
  hostname,
  asStringArray,
  stableHash,
} from "@/lib/utils";

describe("slugify", () => {
  it("creates url-safe slugs", () => {
    expect(slugify("Stripe Inc.")).toBe("stripe-inc");
    expect(slugify("Pay & Go Payments")).toBe("pay-and-go-payments");
    expect(slugify(" 2Checkout (Verifone) ")).toBe("2checkout-verifone");
  });
});

describe("normalizeProviderName", () => {
  it("strips legal suffixes and punctuation", () => {
    expect(normalizeProviderName("Stripe, Inc.")).toBe("stripe");
    expect(normalizeProviderName("PaymentCloud LLC")).toBe("paymentcloud");
    expect(normalizeProviderName("Mollie B.V.")).toBe("mollie");
  });

  it("distinguishes genuinely different providers", () => {
    expect(normalizeProviderName("Razorpay")).not.toBe(
      normalizeProviderName("PayU")
    );
  });
});

describe("hostname", () => {
  it("normalizes hostnames", () => {
    expect(hostname("https://www.Stripe.com/pricing")).toBe("stripe.com");
    expect(hostname("https://pay.amazon.com/x")).toBe("pay.amazon.com");
  });
  it("returns empty string for invalid urls", () => {
    expect(hostname("not-a-url")).toBe("");
  });
});

describe("asStringArray", () => {
  it("filters to strings only", () => {
    expect(asStringArray(["a", 1, "b", null])).toEqual(["a", "b"]);
    expect(asStringArray("nope")).toEqual([]);
    expect(asStringArray(undefined)).toEqual([]);
  });
});

describe("stableHash", () => {
  it("is deterministic and order-sensitive", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"));
    expect(stableHash("abc")).not.toBe(stableHash("acb"));
  });
});
