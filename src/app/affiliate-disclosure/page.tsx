import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Affiliate Disclosure",
  description:
    "How affiliate and referral relationships work on this site and how they affect — and don't affect — our content.",
  path: "/affiliate-disclosure",
});

export default function AffiliateDisclosurePage() {
  return (
    <StaticPage title="Affiliate Disclosure">
      <p>
        Some links on this site are affiliate or referral links. If you click
        one and sign up or make a purchase, we may receive a commission from
        the provider. This costs you nothing extra.
      </p>
      <h2>Our rules</h2>
      <ul>
        <li>
          We only mark a link as an affiliate link after a partnership has
          been formally approved. We never claim a relationship that does not
          exist.
        </li>
        <li>
          Affiliate links are routed through <code>/out/</code> URLs so they are
          easy to identify, and pages using them carry a disclosure notice.
        </li>
        <li>
          Compensation never changes factual fields: eligibility, fees,
          reserves, and restrictions reflect official sources regardless of
          whether a partnership exists.
        </li>
        <li>
          Sponsored placements are labelled &quot;Sponsored&quot;. Sponsorship
          does not alter eligibility data.
        </li>
        <li>
          Providers without affiliate programs are listed on equal footing —
          a missing partnership is never treated as a negative signal.
        </li>
      </ul>
      <h2>Questions</h2>
      <p>
        If you have questions about a specific link or partnership,{" "}
        <a href="/contact">contact us</a>.
      </p>
    </StaticPage>
  );
}
