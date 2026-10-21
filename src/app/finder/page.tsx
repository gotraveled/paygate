import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getCountries,
  getIndustries,
  getPublishedProviders,
} from "@/lib/queries";
import { findMatches } from "@/lib/eligibility";
import { PAYMENT_TYPES, PAYMENT_TYPE_LABELS } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Find a Payment Provider",
  description:
    "Answer three questions to see which payment providers may accept your business — with evidence-based explanations.",
  path: "/finder",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function FinderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Find a Payment Provider
      </h1>
      <p className="mt-2 max-w-2xl text-zinc-600">
        Results are <strong>potential matches</strong> based on published
        policies — never guaranteed approvals. Final decisions are made by each
        provider during underwriting.
      </p>
      <Suspense fallback={null}>
        <FinderForm searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FinderForm({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [countries, industries] = await Promise.all([
    getCountries(),
    getIndustries(),
  ]);
  const val = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v ?? "";
  };
  return (
    <form
      method="get"
      action="/finder"
      className="mt-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-2"
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-zinc-700">
          Where is your company registered?
        </span>
        <Select name="country" defaultValue={val("country")}>
          <option value="">Select country…</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-zinc-700">
          What do you sell?
        </span>
        <Select name="industry" defaultValue={val("industry")}>
          <option value="">Select industry…</option>
          {industries.map((i) => (
            <option key={i.slug} value={i.slug}>
              {i.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-zinc-700">
          Payment type needed
        </span>
        <Select name="type" defaultValue={val("type")}>
          <option value="">Any</option>
          {PAYMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PAYMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-zinc-700">
          Keyword (optional)
        </span>
        <Input name="q" defaultValue={val("q")} placeholder="e.g. subscriptions" />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" className="w-full sm:w-auto">
          Show potential matches
        </Button>
      </div>
    </form>
  );
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const country = Array.isArray(sp.country) ? sp.country[0] : sp.country;
  const industry = Array.isArray(sp.industry) ? sp.industry[0] : sp.industry;
  const type = Array.isArray(sp.type) ? sp.type[0] : sp.type;

  if (!country && !industry && !type) return null;

  const providers = await getPublishedProviders();
  const results = findMatches(providers, {
    countryCode: country?.toUpperCase(),
    industrySlug: industry,
    paymentType: type,
  });

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-zinc-900">
        {results.length} potential match{results.length === 1 ? "" : "es"}
      </h2>
      {results.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-600">
          No providers match these criteria in our current data. Try a broader
          industry category, or check back as the research pipeline expands
          coverage.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {results.map(({ provider, score, reasons, caveats }) => (
            <li
              key={provider.id}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/providers/${provider.slug}`}
                  className="text-lg font-semibold text-zinc-900 hover:text-sky-700"
                >
                  {provider.name}
                </Link>
                <Badge variant="outline">match score {score}</Badge>
              </div>
              {reasons.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {reasons.map((r) => (
                    <li key={r} className="text-sm text-emerald-800">
                      + {r}
                    </li>
                  ))}
                </ul>
              )}
              {caveats.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {caveats.map((c) => (
                    <li key={c} className="text-sm text-amber-800">
                      ! {c}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <Link
                  href={`/providers/${provider.slug}`}
                  className="text-sm font-medium text-sky-700 hover:underline"
                >
                  Review full profile
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
