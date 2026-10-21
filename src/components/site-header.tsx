import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

const NAV = [
  { href: "/providers", label: "Providers" },
  { href: "/finder", label: "Find a Provider" },
  { href: "/compare", label: "Compare" },
  { href: "/countries", label: "Countries" },
  { href: "/industries", label: "Industries" },
  { href: "/business-formation", label: "Business Formation" },
  { href: "/guides", label: "Guides" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="text-base font-bold tracking-tight text-zinc-900">
          {SITE_NAME}
        </Link>
        <nav className="hidden flex-1 items-center gap-4 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <details className="relative ml-auto md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-zinc-300 px-3 py-1.5 text-sm">
            Menu
          </summary>
          <nav className="absolute right-0 mt-2 flex w-48 flex-col rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
