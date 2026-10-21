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
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Countries
      </h1>
      <p className="mt-2 max-w-2xl text-zinc-600">
        Payment provider availability differs by where your company is
        registered — not where your customers are. Choose your business country.
      </p>
      <Suspense fallback={null}>
        <CountryGrid />
      </Suspense>
    </main>
  );
}

async function CountryGrid() {
  const countries = await getCountries();
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {countries.map((c) => (
        <Link
          key={c.code}
          href={`/countries/${c.code.toLowerCase()}`}
          className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-900"
        >
          <span className="font-medium text-zinc-900">{c.name}</span>
          <span className="ml-2 text-xs text-zinc-500">{c.code}</span>
        </Link>
      ))}
    </div>
  );
}
