import { describe, it, expect } from "vitest";
import {
  findFeeMentions,
  findCountryMentions,
  extractPage,
  sectionsFor,
} from "@/lib/research/extract";

describe("findFeeMentions", () => {
  it("keeps real fee patterns with currency context", () => {
    const text =
      "Online card payments cost 2.9% + $0.30 per successful charge. Chargebacks incur a $15.00 dispute fee.";
    const fees = findFeeMentions(text);
    expect(fees.length).toBeGreaterThan(0);
    expect(fees.some((f) => f.includes("2.9"))).toBe(true);
  });

  it("keeps percentage fees with 'fee' context", () => {
    const text =
      "Smart Disputes fee 30% of the disputed amount for each dispute you win.";
    const fees = findFeeMentions(text);
    expect(fees.some((f) => f.includes("30%"))).toBe(true);
  });

  it("drops non-fee percentages (win rates, uptime)", () => {
    const text =
      "Supabase achieved a 45% win rate on disputes with our tooling, and the platform maintains 99.9% uptime.";
    const fees = findFeeMentions(text);
    expect(fees).toHaveLength(0);
  });

  it("drops bare percentages in marketing copy without fee context", () => {
    const text =
      "Grow revenue by 80% and reach 100% of your target audience with our dashboard.";
    expect(findFeeMentions(text)).toHaveLength(0);
  });

  it("keeps INR/other currency-denominated fees", () => {
    const text =
      "Domestic transactions are billed at 2% + GST; international cards attract a 3% fee. The dispute charge is ₹1,000.";
    const fees = findFeeMentions(text);
    expect(fees.length).toBeGreaterThan(0);
  });
});

describe("findCountryMentions", () => {
  it("extracts ISO codes present in text", () => {
    const codes = findCountryMentions(
      "Merchants in the US, GB and IN can apply. MY is not supported."
    );
    expect(codes).toContain("US");
    expect(codes).toContain("GB");
    expect(codes).toContain("IN");
    expect(codes).toContain("MY");
  });
});

describe("sectionsFor / extractPage", () => {
  it("finds sections whose heading matches the bucket", () => {
    const html = `
      <html><body>
        <h2>Pricing</h2><p>We charge 2.9% per transaction.</p>
        <h2>Company</h2><p>Founded in 2010.</p>
      </body></html>`;
    const page = extractPage(html, "https://example.com");
    const pricing = sectionsFor(page, "pricing");
    expect(pricing.length).toBeGreaterThan(0);
    expect(pricing[0].heading).toBe("Pricing");
  });

  it("does not throw on empty html", () => {
    const page = extractPage("", "https://example.com");
    expect(page.sections).toEqual([]);
  });
});
