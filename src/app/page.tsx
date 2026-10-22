import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ProviderCard } from "@/components/provider-card";
import { HeroNetwork } from "@/components/hero-network";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getPublishedProviders,
  getCountries,
  getIndustries,
  getPublishedPages,
} from "@/lib/queries";
import {
  CATEGORY_LABELS,
  PROVIDER_CATEGORIES,
  SITE_TAGLINE,
} from "@/lib/constants";
import { organizationJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Payment Gateway & Processor Directory",
  description: SITE_TAGLINE,
};

export default function Home() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd()),
        }}
      />

      {/* 1 — Hero: dark navy surface, headline, search, network artwork */}
      <section className="pg-grid-dark relative overflow-hidden bg-ink-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-20">
          <div>
            <p className="pg-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11.5px] font-medium uppercase tracking-wider text-mint-300">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-300" />
              Evidence-based provider research
            </p>
            <h1 className="pg-rise pg-rise-d1 mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-[2.9rem]">
              Find payment providers your business can{" "}
              <span className="text-brand-300">actually apply to</span>
            </h1>
            <p className="pg-rise pg-rise-d2 mt-5 max-w-xl text-[15.5px] leading-7 text-ink-200">
              Researched profiles of gateways, processors, and merchant
              account providers — eligibility, fees, reserves, and payout
              terms traced to official documentation. Where a fact is
              unverified, we say so.
            </p>
            <Suspense
              fallback={<div className="mx-auto mt-8 h-28 max-w-2xl" />}
            >
              <HeroSearch />
            </Suspense>
            <div className="pg-rise pg-rise-d3 mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/providers"
                className="text-[13px] font-medium text-ink-200 underline decoration-ink-400 underline-offset-4 transition-colors hover:text-white"
              >
                Browse the full directory
              </Link>
              <span className="text-ink-600" aria-hidden="true">·</span>
              <Link
                href="/editorial-methodology"
                className="text-[13px] font-medium text-ink-200 underline decoration-ink-400 underline-offset-4 transition-colors hover:text-white"
              >
                Read our methodology
              </Link>
            </div>
          </div>
          <div className="pg-fade relative hidden lg:block" aria-hidden="false">
            <HeroNetwork className="mx-auto w-full max-w-[520px]" />
          </div>
        </div>
        {/* Real counts only — no invented stats */}
        <Suspense fallback={<div className="h-12" />}>
          <StatStrip />
        </Suspense>
      </section>

      {/* 2 — Explore providers */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-ink-950">
              Explore payment providers
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Browse by provider model — each profile is researched against
              official documentation.
            </p>
          </div>
          <Link
            href="/providers"
            className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            View all providers →
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {PROVIDER_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/providers?category=${c}`}
              className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-[13px] font-medium text-zinc-700 shadow-sm transition-colors hover:border-brand-400 hover:text-brand-700"
            >
              {CATEGORY_LABELS[c]}
            </Link>
          ))}
        </div>
        <Suspense
          fallback={<p className="mt-6 text-sm text-zinc-500">Loading…</p>}
        >
          <FeaturedProviders />
        </Suspense>
      </section>

      {/* 3 — Find by location & industry */}
      <section className="border-y border-zinc-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-[22px] font-bold tracking-tight text-ink-950">
            Find providers for your business
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Eligibility depends on where your company is registered and what
            it sells — start from either angle.
          </p>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <Suspense fallback={null}>
              <CountryPanel />
            </Suspense>
            <Suspense fallback={null}>
              <IndustryPanel />
            </Suspense>
          </div>
        </div>
      </section>

      {/* 4 + 5 — Compare preview + finder preview */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 lg:grid-cols-2">
        <ComparePreview />
        <FinderPreview />
      </section>

      {/* 6 + 7 — Guides + high-risk research callout */}
      <section className="border-y border-zinc-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight text-ink-950">
                Latest research &amp; practical guides
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Generated from the same records as the directory — always
                reviewed before publication.
              </p>
            </div>
            <Link
              href="/guides"
              className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              All guides →
            </Link>
          </div>
          <Suspense fallback={null}>
            <GuideList />
          </Suspense>
          <HighRiskCallout />
        </div>
      </section>

      {/* 9 — Methodology / transparency */}
      <section className="pg-grid-dark bg-ink-950">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight text-white">
                Evidence first, claims second
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-ink-200">
                Every eligibility status and fee figure in the directory is
                tied to a retrieved official source — or explicitly labeled
                as unverified when it isn&apos;t. We never smooth over the
                difference.
              </p>
              <Link
                href="/editorial-methodology"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-mint-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-mint-400"
              >
                Read the methodology →
              </Link>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  n: "01",
                  t: "Fetch official sources",
                  d: "Pricing pages, restricted-business policies, supported-country lists.",
                },
                {
                  n: "02",
                  t: "Extract to claims",
                  d: "Each claim carries a link to the evidence row it came from.",
                },
                {
                  n: "03",
                  t: "Flag what isn't known",
                  d: "Seed values and missing data stay visibly unverified.",
                },
                {
                  n: "04",
                  t: "Review before publish",
                  d: "Nothing reaches the site without editorial sign-off.",
                },
              ].map((s) => (
                <li
                  key={s.n}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <span className="text-xs font-bold text-brand-300">
                    {s.n}
                  </span>
                  <h3 className="mt-1.5 text-sm font-semibold text-white">
                    {s.t}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-ink-300">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}

async function HeroSearch() {
  const [countries, industries] = await Promise.all([
    getCountries(),
    getIndustries(),
  ]);
  return (
    <form
      method="get"
      action="/finder"
      className="pg-rise pg-rise-d2 mt-7 grid max-w-2xl gap-2.5 rounded-xl border border-white/15 bg-white/[0.06] p-3 backdrop-blur sm:grid-cols-[1fr_1fr_auto]"
    >
      <Select
        name="country"
        aria-label="Your business country"
        defaultValue=""
        className="border-white/15 bg-white/10 text-white focus:border-brand-300 [&>option]:text-ink-950"
      >
        <option value="">Business country…</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        name="industry"
        aria-label="Your industry"
        defaultValue=""
        className="border-white/15 bg-white/10 text-white focus:border-brand-300 [&>option]:text-ink-950"
      >
        <option value="">Industry…</option>
        {industries.map((i) => (
          <option key={i.slug} value={i.slug}>
            {i.name}
          </option>
        ))}
      </Select>
      <Button
        type="submit"
        className="bg-mint-500 px-5 font-semibold text-ink-950 hover:bg-mint-400"
      >
        Check eligibility
      </Button>
    </form>
  );
}

async function StatStrip() {
  const [providers, countries, industries] = await Promise.all([
    getPublishedProviders(),
    getCountries(),
    getIndustries(),
  ]);
  const verified = providers.filter((p) => p.lastVerifiedAt).length;
  const items = [
    { n: providers.length, label: "providers profiled" },
    { n: countries.length, label: "countries researched" },
    { n: industries.length, label: "industry categories" },
    { n: verified, label: "profiles evidence-checked" },
  ];
  return (
    <div className="border-t border-white/10">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-5 sm:grid-cols-4">
        {items.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <dt className="order-2 text-xs text-ink-300">{s.label}</dt>
            <dd className="order-1 text-xl font-bold tabular-nums text-white">
              {s.n}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function FeaturedProviders() {
  const providers = (await getPublishedProviders()).slice(0, 6);
  if (providers.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500">
        No providers published yet — run <code>npm run db:seed</code>.
      </p>
    );
  }
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} />
      ))}
    </div>
  );
}

async function CountryPanel() {
  const countries = await getCountries();
  return (
    <div className="rounded-xl border border-zinc-200 bg-background p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold text-ink-950">
          By business location
        </h3>
        <Link
          href="/countries"
          className="text-[13px] font-semibold text-brand-700 hover:text-brand-800"
        >
          All countries →
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {countries.slice(0, 9).map((c) => (
          <li key={c.code}>
            <Link
              href={`/countries/${c.code.toLowerCase()}`}
              className="block rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:border-brand-400 hover:text-brand-700"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function IndustryPanel() {
  const industries = await getIndustries();
  return (
    <div className="rounded-xl border border-zinc-200 bg-background p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold text-ink-950">
          By industry
        </h3>
        <Link
          href="/industries"
          className="text-[13px] font-semibold text-brand-700 hover:text-brand-800"
        >
          All industries →
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {industries.slice(0, 9).map((i) => (
          <li key={i.id}>
            <Link
              href={`/industries/${i.slug}`}
              className="block rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:border-brand-400 hover:text-brand-700"
            >
              {i.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Comparison preview — real categories/fees, links to the full tool. */
async function ComparePreviewData() {
  const providers = (await getPublishedProviders()).slice(0, 3);
  if (providers.length < 2) return null;
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Provider
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Type
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Headline fee
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Research
            </th>
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => {
            const fee = p.pricing.find((t) => t.kind === "transaction_pct");
            return (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-3 py-2.5 font-medium text-ink-950">
                  <Link
                    href={`/providers/${p.slug}`}
                    className="hover:text-brand-700"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-zinc-600">
                  {CATEGORY_LABELS[p.category] ?? p.category}
                </td>
                <td className="px-3 py-2.5 text-zinc-600">
                  {fee ? `${fee.amountMin ?? "?"}%` : "See provider"}
                </td>
                <td className="px-3 py-2.5">
                  {p.lastVerifiedAt ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="muted">Unverified</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComparePreview() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <h3 className="text-[15px] font-semibold text-ink-950">
        Compare side by side
      </h3>
      <p className="mt-1 text-[13px] leading-5 text-zinc-500">
        Eligibility, fees, and industry acceptance differ per provider — put
        up to three against each other.
      </p>
      <Suspense fallback={null}>
        <ComparePreviewData />
      </Suspense>
      <Link
        href="/compare"
        className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 transition-colors hover:text-brand-800"
      >
        Open the comparison tool →
      </Link>
    </div>
  );
}

function FinderPreview() {
  const steps = [
    "Where is your company registered?",
    "What industry do you sell in?",
    "What payment types do you need?",
  ];
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-5">
      <h3 className="text-[15px] font-semibold text-ink-950">
        Eligibility Finder
      </h3>
      <p className="mt-1 text-[13px] leading-5 text-zinc-600">
        Three questions, then a shortlist of potential matches — with the
        evidence for each.
      </p>
      <ol className="mt-5 space-y-2.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="text-[13px] font-medium text-zinc-700">{s}</span>
          </li>
        ))}
      </ol>
      <Link
        href="/finder"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md"
      >
        Start the finder →
      </Link>
      <p className="mt-3 text-[11.5px] leading-4 text-zinc-500">
        Results are potential matches from published policies — never a
        guarantee of approval.
      </p>
    </div>
  );
}

function HighRiskCallout() {
  return (
    <div className="mt-8 flex flex-col gap-4 rounded-xl border border-warm-200 bg-warm-50 p-5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <h3 className="text-[15px] font-semibold text-warm-900">
          High-risk or specialist business?
        </h3>
        <p className="mt-1 text-[13px] leading-5 text-warm-800">
          Supplements, travel, forex, and similar categories face restricted
          or conditional acceptance at mainstream providers. Our industry
          research flags who publishes a position — and who stays silent.
        </p>
      </div>
      <Link
        href="/industries"
        className="inline-flex shrink-0 items-center rounded-lg border border-warm-300 bg-white px-4 py-2.5 text-sm font-semibold text-warm-800 transition-colors hover:border-warm-500"
      >
        Browse industry research →
      </Link>
    </div>
  );
}

async function GuideList() {
  const pages = (await getPublishedPages()).slice(0, 3);
  if (pages.length === 0) {
    return (
      <p className="mt-5 rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
        Guides publish automatically once enough verified evidence exists —
        the editorial queue is currently building coverage.
      </p>
    );
  }
  return (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((p) => (
        <li key={p.id}>
          <Link
            href={`/guides/${p.slug}`}
            className="pg-lift block h-full rounded-xl border border-zinc-200 bg-white p-5"
          >
            <Badge variant="secondary">{p.type}</Badge>
            <span className="mt-2.5 block text-[15px] font-semibold leading-6 text-ink-950">
              {p.title}
            </span>
            {p.summary && (
              <span className="mt-1.5 block text-[13px] leading-5 text-zinc-500 line-clamp-2">
                {p.summary}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
