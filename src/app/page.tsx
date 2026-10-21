import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ProviderCard } from "@/components/provider-card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getPublishedProviders,
  getCountries,
  getIndustries,
  getPublishedPages,
} from "@/lib/queries";
import { CATEGORY_LABELS, PROVIDER_CATEGORIES, SITE_TAGLINE } from "@/lib/constants";
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
      {/* Hero + search */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-zinc-900">
            Find payment providers your business can actually apply to
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
            Researched profiles of payment gateways, processors, and merchant
            account providers — with eligibility, fees, reserves, and payout
            terms sourced from official documentation.
          </p>
          <Suspense fallback={<div className="mx-auto mt-8 h-24 max-w-3xl" />}>
            <HeroSearch />
          </Suspense>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-semibold text-zinc-900">
          Browse by provider type
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {PROVIDER_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/providers?category=${c}`}
              className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm text-zinc-700 hover:border-zinc-900"
            >
              {CATEGORY_LABELS[c]}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured providers */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-zinc-900">
            Featured providers
          </h2>
          <Link
            href="/providers"
            className="text-sm font-medium text-sky-700 hover:underline"
          >
            View all
          </Link>
        </div>
        <Suspense fallback={<p className="mt-4 text-sm text-zinc-500">Loading…</p>}>
          <FeaturedProviders />
        </Suspense>
      </section>

      {/* Countries + industries */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 md:grid-cols-2">
        <Suspense fallback={null}>
          <CountryList />
        </Suspense>
        <Suspense fallback={null}>
          <IndustryList />
        </Suspense>
      </section>

      {/* Guides */}
      <section className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-xl font-semibold text-zinc-900">
            Guides &amp; research
          </h2>
          <Suspense fallback={null}>
            <GuideList />
          </Suspense>
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
      className="mx-auto mt-8 grid max-w-3xl gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left sm:grid-cols-4"
    >
      <Select name="country" aria-label="Your country" defaultValue="">
        <option value="">Business country…</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select name="industry" aria-label="Your industry" defaultValue="">
        <option value="">Industry…</option>
        {industries.map((i) => (
          <option key={i.slug} value={i.slug}>
            {i.name}
          </option>
        ))}
      </Select>
      <Input name="q" placeholder="Or search by name" aria-label="Search" />
      <Button type="submit">Find providers</Button>
    </form>
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
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} />
      ))}
    </div>
  );
}

async function CountryList() {
  const countries = await getCountries();
  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-900">Country guides</h2>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {countries.map((c) => (
          <li key={c.code}>
            <Link
              href={`/countries/${c.code.toLowerCase()}`}
              className="block rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-700 hover:border-zinc-900"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function IndustryList() {
  const industries = await getIndustries();
  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-900">
        Industries &amp; business types
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {industries.map((i) => (
          <li key={i.id}>
            <Link
              href={`/industries/${i.slug}`}
              className="block rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-700 hover:border-zinc-900"
            >
              {i.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function GuideList() {
  const pages = (await getPublishedPages()).slice(0, 6);
  if (pages.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500">
        Guides are generated automatically once provider research is verified.
      </p>
    );
  }
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((p) => (
        <li key={p.id}>
          <Link
            href={`/guides/${p.slug}`}
            className="block rounded-lg border border-zinc-200 p-4 hover:border-zinc-900"
          >
            <span className="text-sm font-medium text-zinc-900">{p.title}</span>
            {p.summary && (
              <span className="mt-1 block text-xs text-zinc-500 line-clamp-2">
                {p.summary}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
