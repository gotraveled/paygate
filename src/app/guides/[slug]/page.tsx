import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/lib/markdown";
import { getPublishedPage } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

/** Deterministic hash for the hero artwork. */
function hashSlug(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Original geometric illustration — generated per slug, no stock assets. */
function HeroArt({ seed }: { seed: string }) {
  const h = hashSlug(seed);
  const hue = h % 360;
  const shapes = Array.from({ length: 7 }, (_, i) => {
    const x = ((h >> (i * 3)) % 70) + 14;
    const y = ((h >> (i * 4)) % 55) + 16;
    const r = 5 + (((h >> i) % 4) * 5);
    const alt = (h >> i) % 3;
    return { x, y, r, alt, i };
  });
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Abstract payment-flow illustration" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`g${hue}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue} 60% 95%)`} />
          <stop offset="100%" stopColor={`hsl(${(hue + 40) % 360} 55% 90%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#g${hue})`} />
      {shapes.map((s) =>
        s.alt === 0 ? (
          <circle key={s.i} cx={s.x} cy={s.y} r={s.r / 2.5} fill={`hsl(${hue} 45% 45%)`} opacity="0.5" />
        ) : s.alt === 1 ? (
          <rect key={s.i} x={s.x} y={s.y} width={s.r} height={s.r / 2.5} rx="1" fill={`hsl(${(hue + 60) % 360} 40% 50%)`} opacity="0.35" />
        ) : (
          <line key={s.i} x1={s.x} y1={s.y} x2={s.x + s.r} y2={s.y - s.r / 2} stroke={`hsl(${hue} 40% 40%)`} strokeWidth="0.8" opacity="0.5" />
        )
      )}
    </svg>
  );
}

/** Pull `## ` headings from the body for the sidebar TOC. */
function tocEntries(body: string): { id: string; label: string }[] {
  return [...body.matchAll(/^## (.+)$/gm)].map((m) => ({
    id: m[1].toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
    label: m[1],
  }));
}

type Params = Promise<{ slug: string }>;

// Blocking route: the published-status check in the page component must run
// before the response commits so unpublished drafts return a real 404 status.
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return { title: "Not found" };
  return pageMetadata({
    title: page.title,
    description: page.summary ?? page.title,
    path: `/guides/${slug}`,
  });
}

export default async function GuidePage({ params }: { params: Params }) {
  const { slug } = await params;
  // Check existence OUTSIDE Suspense — under Cache Components a notFound()
  // thrown inside the streamed body lands after the 200 shell has committed,
  // producing a soft-404. Only "published" pages exist publicly; drafts,
  // review-queue items, and rejected pages must return a real 404.
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </main>
  );
}

async function Body({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page || page.status !== "published") notFound();

  const toc = tocEntries(page.body);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description: page.summary ?? undefined,
    datePublished: page.publishedAt?.toISOString(),
    dateModified: page.updatedAt.toISOString(),
    author: { "@type": "Organization", name: "PayGate Editorial" },
    mainEntityOfPage: `${siteUrl}/guides/${slug}`,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${siteUrl}/guides` },
      { "@type": "ListItem", position: 3, name: page.title },
    ],
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/" className="transition-colors hover:text-brand-700">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/guides" className="transition-colors hover:text-brand-700">Guides</Link>
        <span aria-hidden="true">/</span>
        <span className="text-zinc-600 line-clamp-1">{page.title}</span>
      </nav>

      <div className="mt-5 flex items-start gap-8">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
            {page.type}
          </p>
          <h1 className="mt-3 text-[32px] font-bold leading-[1.15] tracking-tight text-ink-950">
            {page.title}
          </h1>
          {page.summary && (
            <p className="mt-3 text-[15.5px] leading-7 text-zinc-600">{page.summary}</p>
          )}
        </div>
        <div className="hidden w-40 shrink-0 overflow-hidden rounded-xl shadow-sm sm:block sm:h-40">
          <HeroArt seed={slug} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 border-y border-zinc-200 bg-white py-3 text-xs text-zinc-500">
        {page.publishedAt && <span>Published {formatDate(page.publishedAt)}</span>}
        {page.reviewedAt && (
          <span className="inline-flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-mint-600" aria-hidden="true">
              <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1.2 14.6-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z" />
            </svg>
            Reviewed {formatDate(page.reviewedAt)}
          </span>
        )}
        {page.provider && (
          <span>
            Covers{" "}
            <Link href={`/providers/${page.provider.slug}`} className="font-medium text-brand-700 transition-colors hover:text-brand-800">
              {page.provider.name}
            </Link>
          </span>
        )}
        <Link href="/editorial-methodology" className="ml-auto font-medium text-brand-700 transition-colors hover:text-brand-800">
          Editorial methodology
        </Link>
      </div>

      <div className="mt-8 lg:flex lg:gap-10">
        {toc.length >= 3 && (
          <aside className="mb-8 lg:order-2 lg:mb-0 lg:w-60 lg:shrink-0">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-20">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                On this page
              </p>
              <ul className="mt-3 space-y-2 text-[13px]">
                {toc.map((t) => (
                  <li key={t.id} className="border-l-2 border-zinc-200 pl-3">
                    <a
                      href={`#${t.id}`}
                      className="text-zinc-600 transition-colors hover:border-brand-500 hover:text-brand-700"
                    >
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
        <div className="min-w-0 flex-1">
          <Markdown source={page.body} />
        </div>
      </div>

      <footer className="mt-12 rounded-xl border border-ink-100 bg-ink-50/60 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          About this article
        </h2>
        <div className="mt-2.5 space-y-2 text-xs leading-5 text-zinc-600">
          <p>
            This article is generated from our provider records and checked
            against official sources; fields we could not verify are labeled
            as such rather than filled in. It is produced under our{" "}
            <Link href="/editorial-methodology" className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
              editorial methodology
            </Link>
            .
          </p>
          <p>
            Some pages may include affiliate relationships; if so they are
            disclosed in the article body. Recommendations are based on
            eligibility fit, not commissions.
          </p>
        </div>
      </footer>
    </article>
  );
}
