import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Editorial & Research Methodology",
  description:
    "How our automated research pipeline discovers providers, collects evidence, verifies claims, and detects changes.",
  path: "/editorial-methodology",
});

export default function MethodologyPage() {
  return (
    <StaticPage title="Editorial & Research Methodology">
      <p>
        This site is maintained by an automated research pipeline plus human
        review. This page explains how information gets from a provider&apos;s
        website to these pages.
      </p>
      <h2>Sources of truth</h2>
      <ul>
        <li>
          <strong>Primary:</strong> official provider websites — pricing pages,
          prohibited-business policies, supported-country lists, API
          documentation, and terms of service.
        </li>
        <li>
          <strong>Secondary:</strong> third-party articles and directories are
          used only to discover providers. They never back an eligibility or
          pricing claim on their own.
        </li>
      </ul>
      <h2>The pipeline</h2>
      <ul>
        <li>
          <strong>Discovery:</strong> scheduled jobs find new providers and
          deduplicate them by normalized name and domain.
        </li>
        <li>
          <strong>Research:</strong> official pages are fetched, relevant
          sections extracted, and claims stored as structured evidence with a
          source URL and retrieval date.
        </li>
        <li>
          <strong>Verification:</strong> saved sources are re-fetched on a
          schedule. Content changes are diffed against stored values.
        </li>
        <li>
          <strong>Publication:</strong> generated pages pass factual validation,
          duplicate-content checks, and link checks before publishing.
        </li>
      </ul>
      <h2>Verification labels</h2>
      <ul>
        <li><strong>Supported</strong> — official documentation confirms it.</li>
        <li><strong>Not supported</strong> — official documentation rules it out.</li>
        <li><strong>Conditionally supported</strong> — allowed under stated conditions.</li>
        <li><strong>Not publicly disclosed</strong> — the provider does not publish this.</li>
        <li><strong>Conflicting evidence</strong> — sources disagree; shown as-is.</li>
        <li><strong>Unverified</strong> — not yet confirmed against an official source.</li>
        <li><strong>Outdated</strong> — superseded by newer evidence.</li>
      </ul>
      <h2>What we never do</h2>
      <ul>
        <li>Treat missing information as approval or rejection.</li>
        <li>
          Assume a provider that accepts US merchants also accepts companies
          registered elsewhere — merchant country, owner residency, customer
          geography, and settlement are tracked separately.
        </li>
        <li>Fabricate fees, ratings, reviews, or partnerships.</li>
      </ul>
      <h2>Change handling</h2>
      <p>
        Low-risk corrections (typos, descriptions, links) may be applied
        automatically when evidence is unambiguous. Commercially significant
        changes — fees, country availability, industry restrictions, reserve
        and payout terms — are routed to a review queue before publication.
        Every change is retained in a history log so outdated claims can be
        traced.
      </p>
    </StaticPage>
  );
}
