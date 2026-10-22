import Link from "next/link";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/providers", label: "Providers" },
  { href: "/compare", label: "Compare" },
  { href: "/finder", label: "Eligibility Finder" },
  { href: "/countries", label: "Countries" },
  { href: "/industries", label: "Industries" },
  { href: "/business-formation", label: "Formation" },
  { href: "/guides", label: "Guides" },
];

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/10 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" aria-label="PayGate home" className="shrink-0">
          <Logo />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden flex-1 items-center gap-5 md:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="pg-navlink text-[13.5px] font-medium text-zinc-600 transition-colors hover:text-ink-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            href="/providers"
            aria-label="Search providers"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-500 shadow-sm transition-colors hover:border-brand-400 hover:text-brand-700"
          >
            <SearchIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Search providers</span>
          </Link>
          <Link
            href="/finder"
            className="hidden h-9 items-center rounded-lg bg-brand-600 px-3.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md md:inline-flex"
          >
            Check eligibility
          </Link>
        </div>

        {/* Mobile menu — no-JS friendly details/summary */}
        <details className="group relative md:hidden">
          <summary
            aria-label="Open navigation"
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm marker:hidden [&::-webkit-details-marker]:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-5 w-5 group-open:hidden"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="hidden h-5 w-5 group-open:block"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </summary>
          <nav
            aria-label="Mobile"
            className="pg-fade absolute right-0 mt-2 flex w-60 flex-col rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-ink-50 hover:text-ink-950"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/finder"
              className="mt-1 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Check eligibility
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
