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
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        All Payment Providers
      </h1>
      <p className="mt-2 max-w-2xl text-zinc-600">
        Every profile is built from official documentation. Where a fact is not
        publicly disclosed or still being verified, it is labelled accordingly.
      </p>
      <Suspense fallback={null}>
        <FilterBar searchParams={searchParams} />
      </Suspense>
      <Suspense
        fallback={<p className="mt-8 text-sm text-zinc-500">Loading…</p>}
      >
        <Results searchParams={searchParams} />
      </Suspense>
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
      <p className="mt-6 text-sm text-zinc-500">
        {providers.length} provider{providers.length === 1 ? "" : "s"}
      </p>
      {providers.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
          No providers match these filters yet. Our research pipeline expands
          the directory continuously — try broadening your search.
        </p>
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
