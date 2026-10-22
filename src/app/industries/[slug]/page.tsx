import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { getIndustry, getProvidersForIndustry } from "@/lib/queries";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

type Params = Promise<{ slug: string }>;

// Blocking route: unknown industry slugs must return a real 404 status.
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const industry = await getIndustry(slug);
  if (!industry) return { title: "Industry not found" };
  return pageMetadata({
    title: `Payment Providers for ${industry.name}`,
    description: `Payment gateways and processors whose policies address ${industry.name} businesses — with evidence-based acceptance status.`,
    path: `/industries/${slug}`,
  });
}

export default async function IndustryPage({ params }: { params: Params }) {
  const { slug } = await params;
  // Existence check outside Suspense so notFound() yields a real 404 status.
  const industry = await getIndustry(slug);
  if (!industry) notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </main>
  );
}

async function Body({ params }: { params: Params }) {
  const { slug } = await params;
  const [industry, providers] = await Promise.all([
    getIndustry(slug),
    getProvidersForIndustry(slug),
  ]);
  if (!industry) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Industries", path: "/industries" },
              { name: industry.name, path: `/industries/${slug}` },
            ])
          ),
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-bold tracking-tight text-ink-950">
          {industry.name}
        </h1>
        {industry.riskLevel !== "standard" && (
          <Badge variant={industry.riskLevel === "high" ? "danger" : "warning"}>
            {industry.riskLevel} risk
          </Badge>
        )}
      </div>
      {industry.summary && (
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-zinc-600">
          {industry.summary}
        </p>
      )}

      <h2 className="mt-10 flex items-center gap-3 text-lg font-semibold text-ink-950">
        <span className="h-4 w-1 rounded-full bg-brand-600" aria-hidden="true" />
        Providers covering this industry
      </h2>
      {providers.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-500">
          No providers researched for this industry yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {providers.map((p) => {
            const rel = p.industries.find((i) => i.industry.slug === slug);
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/providers/${p.slug}`}
                    className="text-[14px] font-semibold text-ink-950 transition-colors hover:text-brand-700"
                  >
                    {p.name}
                  </Link>
                  {rel?.notes && (
                    <p className="mt-0.5 text-xs text-zinc-500">{rel.notes}</p>
                  )}
                </div>
                {rel && <StatusBadge status={rel.status} />}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-zinc-500">
        Statuses reflect official prohibited-business or restricted-business
        policies where published. &quot;Unverified&quot; means we have not yet
        confirmed an official position — it does not imply rejection or
        acceptance.
      </p>
    </>
  );
}
