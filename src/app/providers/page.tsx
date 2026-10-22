import { Suspense } from "react";
import type { Metadata } from "next";
import { ProviderCard } from "@/components/provider-card";
import { ProviderFilters } from "@/components/provider-filters";
import {
  searchProviders,
  getCountries,
  getIndustries,
} from "@/lib/queries";
import { pageMetadata, itemListJsonLd } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "All Payment Providers",
  description:
    "Directory of payment gateways, processors, merchant account providers, and related services with researched eligibility and fee data.",
  path: "/providers",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ProvidersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-7 pt-10">
          <h1 className="text-[28px] font-bold tracking-tight text-ink-950">
            Payment provider directory
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-zinc-600">
            Every profile is built from official documentation. Where a fact
            is not publicly disclosed or still being verified, it is labelled
            accordingly.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-7">
        <Suspense fallback={null}>
          <FilterBar searchParams={searchParams} />
        </Suspense>
        <Suspense
          fallback={<p className="mt-8 text-sm text-zinc-500">Loading…</p>}
        >
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function FilterBar({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const [countries, industries] = await Promise.all([
    getCountries(),
    getIndustries(),
  ]);
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  return (
    <div className="mt-6">
      <ProviderFilters
        q={first(sp.q)}
        category={first(sp.category)}
        country={first(sp.country)}
        industry={first(sp.industry)}
        countries={countries}
        industries={industries}
      />
    </div>
  );
}

async function Results({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const providers = await searchProviders({
    q: first(sp.q),
    category: first(sp.category),
    country: first(sp.country)?.toUpperCase(),
    industry: first(sp.industry),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            itemListJsonLd(
              "Payment providers",
              providers.map((p) => ({
                name: p.name,
                path: `/providers/${p.slug}`,
              }))
            )
          ),
        }}
      />
      <div className="mt-6 flex items-baseline justify-between">
        <p className="text-sm text-zinc-500">
          <span className="font-semibold tabular-nums text-ink-950">
            {providers.length}
          </span>{" "}
          provider{providers.length === 1 ? "" : "s"}
        </p>
        <p className="hidden text-xs text-zinc-400 sm:block">
          Verified profiles carry a mint badge; unverified rows stay muted.
        </p>
      </div>
      {providers.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-zinc-700">
            No providers match these filters
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            The research pipeline expands the directory continuously — try
            broadening the search.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      )}
    </>
  );
}
