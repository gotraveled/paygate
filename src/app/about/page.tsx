import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About Us",
  description: "Who runs this directory and why it exists.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <StaticPage title="About Us">
      <p>
        This site is an independent research directory covering payment
        gateways, payment processors, merchant account providers, and related
        business services. It exists because choosing a payment provider is
        harder than it should be: eligibility rules differ by country and
        industry, fees are scattered across documentation, and policies change
        without notice.
      </p>
      <h2>What we do</h2>
      <ul>
        <li>Research official provider documentation and record what it says.</li>
        <li>Track which countries and industries each provider supports.</li>
        <li>Label every claim by verification status — we never guess.</li>
        <li>Re-check sources on a schedule and record changes over time.</li>
      </ul>
      <h2>How we make money</h2>
      <p>
        Some outbound links are affiliate or referral links. If you sign up
        through one, we may earn a commission at no extra cost to you. This
        never changes what our research records say — see the{" "}
        <a href="/affiliate-disclosure">affiliate disclosure</a> and{" "}
        <a href="/editorial-methodology">editorial methodology</a>.
      </p>
      <h2>What we don&apos;t do</h2>
      <ul>
        <li>Sell payment processing or financial products.</li>
        <li>Guarantee account approvals.</li>
        <li>Publish invented reviews, ratings, or personal experiences.</li>
        <li>Present unverified information as fact.</li>
      </ul>
    </StaticPage>
  );
}
