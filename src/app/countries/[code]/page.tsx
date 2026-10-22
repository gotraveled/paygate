import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProviderCard } from "@/components/provider-card";
import { StatusBadge } from "@/components/status-badge";
import { getCountry, getProvidersForCountry } from "@/lib/queries";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

type Params = Promise<{ code: string }>;

// Blocking route: unknown country codes must return a real 404 status.
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { code } = await params;
  const country = await getCountry(code.toUpperCase());
  if (!country) return { title: "Country not found" };
  return pageMetadata({
    title: `Payment Providers for ${country.name} Businesses`,
    description: `Which payment gateways and processors accept merchant applications from companies registered in ${country.name}.`,
    path: `/countries/${code.toLowerCase()}`,
  });
}

export default async function CountryPage({ params }: { params: Params }) {
  const { code } = await params;
  // Existence check outside Suspense so notFound() yields a real 404 status.
  const country = await getCountry(code.toUpperCase());
  if (!country) notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </main>
  );
}

async function Body({ params }: { params: Params }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const [country, providers] = await Promise.all([
    getCountry(upper),
    getProvidersForCountry(upper),
  ]);
  if (!country) notFound();

  const verified = providers.filter((p) =>
    p.countries.some(
      (c) =>
        c.countryCode === upper &&
        c.scope === "merchant_apply" &&
        c.status === "supported"
    )
  );
  const conditional = providers.filter((p) =>
    p.countries.some(
      (c) =>
        c.countryCode === upper &&
        c.scope === "merchant_apply" &&
        ["conditional", "unverified", "undisclosed"].includes(c.status)
    )
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Countries", path: "/countries" },
              { name: country.name, path: `/countries/${code.toLowerCase()}` },
            ])
          ),
        }}
      />
      <h1 className="text-[28px] font-bold tracking-tight text-ink-950">
        Payment providers for {country.name}
      </h1>
      <p className="mt-2 max-w-3xl text-[15px] leading-6 text-zinc-600">
        {country.intro ??
          `Providers below are grouped by whether official documentation confirms merchant applications from ${country.name}. Eligibility is never a guarantee of account approval — underwriting decisions rest with each provider.`}
      </p>

      <h2 className="mt-10 flex items-center gap-2.5 text-lg font-semibold text-ink-950">
        <span className="h-2 w-2 rounded-full bg-mint-500" aria-hidden="true" />
        Confirmed to accept {country.name} merchants
      </h2>
      {verified.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-500">
          No providers are verified for {country.name} yet — our research
          pipeline is still working through the directory.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {verified.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      )}

      {conditional.length > 0 && (
        <>
          <h2 className="mt-10 flex items-center gap-2.5 text-lg font-semibold text-ink-950">
            <span className="h-2 w-2 rounded-full bg-warm-400" aria-hidden="true" />
            Conditional or unverified for {country.name}
          </h2>
          <ul className="mt-4 space-y-2">
            {conditional.map((p) => {
              const elig = p.countries.find(
                (c) => c.countryCode === upper && c.scope === "merchant_apply"
              );
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3"
                >
                  <Link
                    href={`/providers/${p.slug}`}
                    className="text-sm font-medium text-ink-950 transition-colors hover:text-brand-700"
                  >
                    {p.name}
                  </Link>
                  {elig && <StatusBadge status={elig.status} />}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
