import Link from "next/link";
import { Logo } from "@/components/logo";
import { SITE_NAME } from "@/lib/constants";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Directory",
    links: [
      { href: "/providers", label: "All Providers" },
      { href: "/finder", label: "Find a Provider" },
      { href: "/compare", label: "Compare Providers" },
      { href: "/business-formation", label: "Business Formation" },
    ],
  },
  {
    title: "Research",
    links: [
      { href: "/countries", label: "Countries" },
      { href: "/industries", label: "Industries" },
      { href: "/guides", label: "Guides" },
      { href: "/editorial-methodology", label: "Editorial Methodology" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/affiliate-disclosure", label: "Affiliate Disclosure" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms and Conditions" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink-950 text-ink-200">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo dark />
            <p className="mt-4 max-w-xs text-[13px] leading-6 text-ink-300">
              Evidence-based profiles of payment providers — eligibility,
              fees, reserves, and payout terms traced to official sources.
            </p>
            <Link
              href="/editorial-methodology"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-mint-300 transition-colors hover:text-mint-200"
            >
              How our research works
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-ink-200 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs leading-5 text-ink-400">
          {SITE_NAME} publishes independent research for informational purposes
          only. Some outbound links are affiliate links — see our{" "}
          <Link
            href="/affiliate-disclosure"
            className="text-ink-200 underline decoration-ink-400 underline-offset-2 hover:text-white"
          >
            affiliate disclosure
          </Link>
          . Eligibility statuses describe published policies, not guaranteed
          approvals; always confirm current terms on each provider&apos;s
          official website.
        </p>
      </div>
    </footer>
  );
}
