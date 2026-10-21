import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: "How to reach us — corrections, provider updates, and general enquiries.",
  path: "/contact",
});

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@example.com";
  return (
    <StaticPage title="Contact">
      <p>
        Corrections and provider updates are the most valuable messages we
        receive — if you spot something wrong or outdated, please include the
        official source URL so we can verify it quickly.
      </p>
      <h2>Email</h2>
      <p>
        <a href={`mailto:${email}`}>{email}</a>
      </p>
      <h2>What to include</h2>
      <ul>
        <li>The page URL you are writing about.</li>
        <li>What is wrong or missing.</li>
        <li>A link to official documentation supporting the correction.</li>
      </ul>
      <p>
        We cannot provide individual payment advice, application help, or
        mediation with providers.
      </p>
    </StaticPage>
  );
}
