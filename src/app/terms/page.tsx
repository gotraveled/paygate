import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms and Conditions",
  description: "Terms of use for this informational website.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <StaticPage title="Terms and Conditions" updated="2026-10-21">
      <h2>Informational content only</h2>
      <p>
        This site provides general information about payment service providers.
        It is not financial, legal, or tax advice, and it does not create any
        advisory relationship. Always confirm terms on a provider&apos;s
        official website before acting.
      </p>
      <h2>No guarantees</h2>
      <p>
        Eligibility indications are potential matches based on published
        policies — they are not approval guarantees. Providers change policies
        without notice; information may be incomplete or outdated despite our
        verification process.
      </p>
      <h2>Third-party links</h2>
      <p>
        Links to provider websites are provided for convenience. We are not
        responsible for third-party content, terms, or practices. Some links
        are affiliate links — see the{" "}
        <a href="/affiliate-disclosure">affiliate disclosure</a>.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not scrape the site at a rate that degrades service.</li>
        <li>Do not misrepresent our content as official provider statements.</li>
      </ul>
      <h2>Liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for decisions
        made based on information on this site.
      </p>
    </StaticPage>
  );
}
