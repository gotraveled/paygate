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
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Guides &amp; Research
      </h1>
      <p className="mt-2 text-zinc-600">
        Articles generated from verified database records and reviewed before
        publication.
      </p>
      <Suspense fallback={null}>
        <List />
      </Suspense>
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
    <ul className="mt-6 space-y-3">
      {pages.map((p) => (
        <li key={p.id}>
          <Link
            href={`/guides/${p.slug}`}
            className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-900"
          >
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{p.type}</Badge>
              {p.publishedAt && (
                <span className="text-xs text-zinc-400">
                  {formatDate(p.publishedAt)}
                </span>
              )}
            </div>
            <span className="mt-1 block font-medium text-zinc-900">
              {p.title}
            </span>
            {p.summary && (
              <span className="mt-1 block text-sm text-zinc-500 line-clamp-2">
                {p.summary}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
