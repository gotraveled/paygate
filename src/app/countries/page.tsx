import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getCountries } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Countries — Where You Can Apply",
  description:
    "Country-by-country guides to payment provider availability for merchant applications.",
  path: "/countries",
});

export default function CountriesPage() {
  return (
    <main>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-7 pt-10">
          <h1 className="text-[28px] font-bold tracking-tight text-ink-950">
            Countries
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-zinc-600">
            Payment provider availability differs by where your company is
            registered — not where your customers are. Choose your business
            country.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-7">
        <Suspense fallback={null}>
          <CountryGrid />
        </Suspense>
      </div>
    </main>
  );
}

async function CountryGrid() {
  const countries = await getCountries();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {countries.map((c) => (
        <Link
          key={c.code}
          href={`/countries/${c.code.toLowerCase()}`}
          className="pg-lift flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3.5"
        >
          <span className="text-[14px] font-medium text-ink-950">{c.name}</span>
          <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-500">
            {c.code}
          </span>
        </Link>
      ))}
    </div>
  );
}
