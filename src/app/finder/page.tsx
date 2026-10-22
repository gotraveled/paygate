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
    <main>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 pb-7 pt-10">
          <h1 className="text-[28px] font-bold tracking-tight text-ink-950">
            Eligibility Finder
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-zinc-600">
            Answer three questions to see which providers <em>may</em> accept
            your business. Results are <strong>potential matches</strong> from
            published policies — never guaranteed approvals; underwriting
            decisions rest with each provider.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-7">
        <Suspense fallback={null}>
          <FinderForm searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={null}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
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
  const steps = [
    { n: 1, label: "Where is your company registered?", input: (
      <Select name="country" defaultValue={val("country")}>
        <option value="">Select country…</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Select>
    )},
    { n: 2, label: "What do you sell?", input: (
      <Select name="industry" defaultValue={val("industry")}>
        <option value="">Select industry…</option>
        {industries.map((i) => (
          <option key={i.slug} value={i.slug}>
            {i.name}
          </option>
        ))}
      </Select>
    )},
    { n: 3, label: "What do you need to accept?", input: (
      <Select name="type" defaultValue={val("type")}>
        <option value="">Any payment type</option>
        {PAYMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {PAYMENT_TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
    )},
  ];
  return (
    <form
      method="get"
      action="/finder"
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-5 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n}>
            <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-950">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                {s.n}
              </span>
              {s.label}
            </span>
            <div className="mt-2.5">{s.input}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-zinc-100 pt-5">
        <label className="block flex-1 sm:max-w-xs">
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            Keyword (optional)
          </span>
          <Input name="q" defaultValue={val("q")} placeholder="e.g. subscriptions" />
        </label>
        <Button type="submit" className="self-end">
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
              className="pg-lift rounded-xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/providers/${provider.slug}`}
                    className="text-lg font-semibold text-ink-950 transition-colors hover:text-brand-700"
                  >
                    {provider.name}
                  </Link>
                </div>
                <Badge variant={score >= 3 ? "success" : score >= 1 ? "info" : "muted"}>
                  match score {score}
                </Badge>
              </div>
              {reasons.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-[13px] leading-5 text-mint-800">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true">
                        <path d="m9.6 15.6-3.9-3.9L4.3 13l5.3 5.3 11-11-1.4-1.4-9.6 9.7Z" />
                      </svg>
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              {caveats.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {caveats.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-[13px] leading-5 text-warm-800">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true">
                        <path d="M12 2 1 21h22L12 2Zm1 14h-2v-2h2v2Zm0-4h-2v-4h2v4Z" />
                      </svg>
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-zinc-100 pt-3">
                <Link
                  href={`/providers/${provider.slug}`}
                  className="text-[13px] font-semibold text-brand-700 transition-colors hover:text-brand-800"
                >
                  Review full profile &amp; sources →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
