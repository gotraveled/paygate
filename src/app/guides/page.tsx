import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { getPublishedPages } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Guides & Research",
  description:
    "Educational guides on rolling reserves, chargebacks, fees, underwriting, and settlement — generated from verified provider data.",
  path: "/guides",
});

export default function GuidesPage() {
  return (
    <main>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-7 pt-10">
          <h1 className="text-[28px] font-bold tracking-tight text-ink-950">
            Guides &amp; research
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-zinc-600">
            Articles generated from verified database records and reviewed
            before publication — never fabricated.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-7">
        <Suspense fallback={null}>
          <List />
        </Suspense>
      </div>
    </main>
  );
}

async function List() {
  const pages = await getPublishedPages();
  if (pages.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
        No published guides yet. Content is produced automatically once enough
        verified evidence exists for a topic.
      </p>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((p) => (
        <li key={p.id}>
          <Link
            href={`/guides/${p.slug}`}
            className="pg-lift block h-full rounded-xl border border-zinc-200 bg-white p-5"
          >
            <div className="flex items-center gap-2">
              <Badge variant="info">{p.type}</Badge>
              {p.publishedAt && (
                <span className="text-[11px] text-zinc-400">
                  {formatDate(p.publishedAt)}
                </span>
              )}
            </div>
            <span className="mt-2.5 block text-[15px] font-semibold leading-6 text-ink-950">
              {p.title}
            </span>
            {p.summary && (
              <span className="mt-1.5 block text-[13px] leading-5 text-zinc-500 line-clamp-3">
                {p.summary}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
