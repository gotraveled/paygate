import Link from "next/link";
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
    <footer className="border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 text-sm font-semibold text-zinc-900">
              {col.title}
            </h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-zinc-600 hover:text-zinc-900"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 py-4">
        <p className="mx-auto max-w-6xl px-4 text-xs text-zinc-500">
          {SITE_NAME} publishes independent research for informational purposes.
          Some outbound links are affiliate links — see our{" "}
          <Link href="/affiliate-disclosure" className="underline">
            affiliate disclosure
          </Link>
          . Information may change; always confirm terms on the provider&apos;s
          official website.
        </p>
      </div>
    </footer>
  );
}
