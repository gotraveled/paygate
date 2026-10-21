import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { getProviderBySlug } from "@/lib/queries";
import {
  CATEGORY_LABELS,
  SCOPE_LABELS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/constants";
import { asStringArray, formatDate } from "@/lib/utils";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

type Params = Promise<{ slug: string }>;

// Blocking route: unpublished providers must return a real 404 status.
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProviderBySlug(slug);
  if (!p) return { title: "Provider not found" };
  return pageMetadata({
    title: `${p.name} — Fees, Eligibility & Requirements`,
    description:
      p.summary ??
      `Researched profile of ${p.name}: eligibility, fees, reserves, payouts, and application requirements.`,
    path: `/providers/${slug}`,
  });
}

export default async function ProviderPage({ params }: { params: Params }) {
  const { slug } = await params;
  // Existence + status check outside Suspense so notFound() yields a real
  // 404 status (inside the streamed body it lands after the 200 shell).
  const p = await getProviderBySlug(slug);
  if (!p || p.status !== "published") notFound();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: { params: Params }) {
  const { slug } = await params;
  const p = await getProviderBySlug(slug);
  if (!p || p.status !== "published") notFound();

  const apply = p.countries.filter((c) => c.scope === "merchant_apply");
  const pay = p.countries.filter((c) => c.scope === "customer_pay");
  const settle = p.countries.filter((c) => c.scope === "settlement");
  const officialSources = p.evidence
    .map((e) => e.source)
    .filter((s): s is NonNullable<typeof s> => !!s && s.sourceType === "official")
    .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Providers", path: "/providers" },
              { name: p.name, path: `/providers/${p.slug}` },
            ])
          ),
        }}
      />

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            {p.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {CATEGORY_LABELS[p.category] ?? p.category}
            </Badge>
            {p.sponsored && <Badge variant="info">Sponsored</Badge>}
            {p.lastVerifiedAt ? (
              <Badge variant="success">
                Verified {formatDate(p.lastVerifiedAt)}
              </Badge>
            ) : (
              <StatusBadge status="unverified" />
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {p.affiliateUrl ? (
            <Link
              href={`/out/${p.slug}`}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Visit {p.name} *
            </Link>
          ) : (
            <a
              href={p.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Official site
            </a>
          )}
        </div>
      </header>
      {p.affiliateUrl && (
        <p className="mt-2 text-xs text-zinc-500">
          * Affiliate link — we may earn a commission at no cost to you.{" "}
          <Link href="/affiliate-disclosure" className="underline">
            Disclosure
          </Link>
        </p>
      )}

      {p.summary && (
        <p className="mt-6 max-w-3xl text-lg text-zinc-700">{p.summary}</p>
      )}
      {p.suitableFor && (
        <Section title="Who it suits">
          <p>{p.suitableFor}</p>
        </Section>
      )}

      {/* Geography */}
      <Section title="Countries &amp; availability">
        <div className="grid gap-6 md:grid-cols-3">
          <CountryGroup
            label={SCOPE_LABELS.merchant_apply}
            items={apply}
          />
          <CountryGroup
            label={SCOPE_LABELS.customer_pay}
            items={pay}
          />
          <CountryGroup
            label={SCOPE_LABELS.settlement}
            items={settle}
          />
        </div>
        {(p.registrationRequirement || p.ownerResidency) && (
          <dl className="mt-4 space-y-1 text-sm">
            {p.registrationRequirement && (
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 font-medium text-zinc-700">
                  Company registration
                </dt>
                <dd>{p.registrationRequirement}</dd>
              </div>
            )}
            {p.ownerResidency && (
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 font-medium text-zinc-700">
                  Owner residency
                </dt>
                <dd>{p.ownerResidency}</dd>
              </div>
            )}
          </dl>
        )}
      </Section>

      {/* Industries */}
      <Section title="Industry acceptance">
        {p.industries.length === 0 ? (
          <Missing text="Industry acceptance has not been researched for this provider yet." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.industries.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2"
              >
                <Link
                  href={`/industries/${i.industry.slug}`}
                  className="text-sm text-zinc-800 hover:underline"
                >
                  {i.industry.name}
                </Link>
                <StatusBadge status={i.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Payment types + features */}
      <Section title="Payment types &amp; integrations">
        <div className="flex flex-wrap gap-2">
          {asStringArray(p.paymentTypes).length > 0
            ? asStringArray(p.paymentTypes).map((t) => (
                <Badge key={t} variant="secondary">
                  {(PAYMENT_TYPE_LABELS as Record<string, string>)[t] ?? t}
                </Badge>
              ))
            : null}
          {p.features.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1">
              <Badge variant="outline">{f.key.replace(/_/g, " ")}</Badge>
              <StatusBadge status={f.status} />
            </span>
          ))}
          {asStringArray(p.paymentTypes).length === 0 &&
            p.features.length === 0 && (
              <Missing text="Feature support has not been documented yet." />
            )}
        </div>
      </Section>

      {/* Pricing */}
      <Section title="Published fees &amp; charges">
        {p.pricing.length === 0 ? (
          <Missing text="No published pricing has been captured yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Region</th>
                  <th className="py-2">Conditions</th>
                </tr>
              </thead>
              <tbody>
                {p.pricing.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-4 font-medium">{t.label}</td>
                    <td className="py-2 pr-4">
                      {t.amountMin != null
                        ? `${t.amountMin}${t.unit === "percent" ? "%" : ` ${t.currency ?? ""}`}`
                        : "—"}
                      {t.amountMax != null && t.amountMax !== t.amountMin
                        ? `–${t.amountMax}${t.unit === "percent" ? "%" : ""}`
                        : ""}
                    </td>
                    <td className="py-2 pr-4">{t.region ?? "—"}</td>
                    <td className="py-2 text-zinc-600">{t.conditions ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Reserves & payouts */}
      <Section title="Reserves, payouts &amp; settlement">
        {p.reserves.length === 0 ? (
          <Missing text="Reserve and payout terms are undisclosed or not yet captured." />
        ) : (
          <ul className="space-y-2">
            {p.reserves.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-zinc-200 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">
                    {r.kind.replace(/_/g, " ")}
                  </span>
                  {r.percent != null && (
                    <Badge variant="secondary">{r.percent}%</Badge>
                  )}
                </div>
                <p className="mt-1 text-zinc-600">{r.summary}</p>
                {r.conditions && (
                  <p className="mt-1 text-xs text-zinc-500">{r.conditions}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Application */}
      <Section title="How to apply">
        {asStringArray(p.requiredDocs).length > 0 && (
          <>
            <h3 className="mb-1 text-sm font-semibold text-zinc-800">
              Documents typically required
            </h3>
            <ul className="mb-4 list-disc space-y-1 pl-6">
              {asStringArray(p.requiredDocs).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </>
        )}
        {asStringArray(p.applicationSteps).length > 0 ? (
          <ol className="list-decimal space-y-2 pl-6">
            {asStringArray(p.applicationSteps).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        ) : (
          <Missing text="Application steps have not been documented yet." />
        )}
      </Section>

      {/* Pros/cons */}
      {(asStringArray(p.pros).length > 0 || asStringArray(p.cons).length > 0) && (
        <Section title="Advantages &amp; disadvantages">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-emerald-800">
                Advantages
              </h3>
              <ul className="list-disc space-y-1 pl-6">
                {asStringArray(p.pros).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-red-800">
                Disadvantages
              </h3>
              <ul className="list-disc space-y-1 pl-6">
                {asStringArray(p.cons).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      )}

      {p.limitations && (
        <Section title="Important limitations">
          <p>{p.limitations}</p>
        </Section>
      )}

      {/* Sources */}
      <Section title="Sources &amp; verification">
        {officialSources.length === 0 ? (
          <Missing text="No official sources recorded yet." />
        ) : (
          <ul className="space-y-1 text-sm">
            {officialSources.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-sky-700 hover:underline"
                >
                  {s.title ?? s.url}
                </a>
                {s.lastFetchedAt && (
                  <span className="ml-2 text-xs text-zinc-500">
                    retrieved {formatDate(s.lastFetchedAt)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          Research status: {p.evidence.length} evidence record
          {p.evidence.length === 1 ? "" : "s"} on file. See our{" "}
          <Link href="/editorial-methodology" className="underline">
            methodology
          </Link>
          .
        </p>
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 border-b border-zinc-200 pb-2 text-lg font-semibold text-zinc-900">
        {title}
      </h2>
      <div className="text-sm leading-6 text-zinc-700">{children}</div>
    </section>
  );
}

function Missing({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500">
      {text}
    </p>
  );
}

function CountryGroup({
  label,
  items,
}: {
  label: string;
  items: {
    id: string;
    status: string;
    country: { code: string; name: string };
  }[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-800">{label}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">Not disclosed</p>
      ) : (
        <ul className="space-y-1">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <Link
                href={`/countries/${i.country.code.toLowerCase()}`}
                className="text-zinc-700 hover:underline"
              >
                {i.country.name}
              </Link>
              <StatusBadge status={i.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
