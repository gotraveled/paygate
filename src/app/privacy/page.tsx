import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "What data this site collects and how it is used.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy Policy" updated="2026-10-21">
      <p>
        This is an informational website. We collect the minimum data needed
        to operate it.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Referral clicks:</strong> when you click an outbound link to a
          provider, we record the destination and timestamp to measure which
          links are useful. No account or identity is required.
        </li>
        <li>
          <strong>Analytics:</strong> aggregate usage statistics may be
          collected via privacy-respecting analytics. No cross-site tracking.
        </li>
        <li>
          <strong>Email:</strong> if you contact us, we retain the message to
          respond.
        </li>
      </ul>
      <h2>What we don&apos;t do</h2>
      <ul>
        <li>No user accounts, no payment data, no sensitive personal data.</li>
        <li>No selling of personal information.</li>
        <li>No advertising trackers or third-party data brokers.</li>
      </ul>
      <h2>Cookies</h2>
      <p>
        The site itself does not set tracking cookies. Third-party analytics,
        if enabled, may set their own — check your browser settings to control
        them.
      </p>
      <h2>Changes</h2>
      <p>
        If this policy changes materially, the updated date above will change
        and a note will be added here.
      </p>
    </StaticPage>
  );
}
