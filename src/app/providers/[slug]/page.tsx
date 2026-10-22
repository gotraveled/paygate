import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { ProviderMark } from "@/components/provider-mark";
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

      {/* Header — navy band with monogram + verification authority */}
      <header className="pg-grid-dark -mx-4 -mt-10 mb-8 bg-ink-950 px-4 pb-8 pt-10 sm:-mx-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <ProviderMark name={p.name} slug={p.slug} size="lg" className="mt-1 rounded-xl shadow-lg ring-1 ring-white/15" />
            <div>
              <h1 className="text-[30px] font-bold tracking-tight text-white">
                {p.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-ink-100">
                  {CATEGORY_LABELS[p.category] ?? p.category}
                </span>
                {p.sponsored && (
                  <span className="rounded-full border border-brand-300/40 bg-brand-500/20 px-2.5 py-0.5 text-xs font-medium text-brand-200">
                    Sponsored
                  </span>
                )}
                {p.lastVerifiedAt ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-mint-400/40 bg-mint-500/15 px-2.5 py-0.5 text-xs font-semibold text-mint-200">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                      <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1.2 14.6-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z" />
                    </svg>
                    Research verified {formatDate(p.lastVerifiedAt)}
                  </span>
                ) : (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-ink-300">
                    Research in progress — unverified
                  </span>
                )}
              </div>
              {p.summary && (
                <p className="mt-3 max-w-xl text-[14px] leading-6 text-ink-200">
                  {p.summary}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {p.affiliateUrl ? (
              <Link
                href={`/out/${p.slug}`}
                className="rounded-lg bg-mint-500 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-sm transition-colors hover:bg-mint-400"
              >
                Visit {p.name} *
              </Link>
            ) : (
              <a
                href={p.websiteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
              >
                Official site ↗
              </a>
            )}
            {p.affiliateUrl && (
              <p className="max-w-[220px] text-right text-[11px] leading-4 text-ink-400">
                * Affiliate link — we may earn a commission at no cost to
                you.{" "}
                <Link
                  href="/affiliate-disclosure"
                  className="underline underline-offset-2 hover:text-ink-200"
                >
                  Disclosure
                </Link>
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl">
      {p.suitableFor && (
        <Section title="Who it suits">
          <p>{p.suitableFor}</p>
        </Section>
      )}

      {/* Geography — three distinct eligibility scopes */}
      <Section title="Countries &amp; availability">
        <div className="grid gap-4 md:grid-cols-3">
          <CountryGroup
            label={SCOPE_LABELS.merchant_apply}
            hint="where a merchant account can be opened"
            items={apply}
          />
          <CountryGroup
            label={SCOPE_LABELS.customer_pay}
            hint="where shoppers' cards are accepted"
            items={pay}
          />
          <CountryGroup
            label={SCOPE_LABELS.settlement}
            hint="where payouts can be settled"
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
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5"
              >
                <Link
                  href={`/industries/${i.industry.slug}`}
                  className="text-[13px] font-medium text-zinc-800 transition-colors hover:text-brand-700"
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
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Region</th>
                  <th className="px-4 py-3 font-semibold">Conditions</th>
                </tr>
              </thead>
              <tbody>
                {p.pricing.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink-950">{t.label}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-ink-950">
                      {t.amountMin != null
                        ? `${t.amountMin}${t.unit === "percent" ? "%" : ` ${t.currency ?? ""}`}`
                        : "—"}
                      {t.amountMax != null && t.amountMax !== t.amountMin
                        ? `–${t.amountMax}${t.unit === "percent" ? "%" : ""}`
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{t.region ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{t.conditions ?? "—"}</td>
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
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {officialSources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="truncate text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800 hover:underline"
                >
                  {s.title ?? s.url}
                </a>
                {s.lastFetchedAt && (
                  <span className="shrink-0 text-[11px] text-zinc-400">
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
      </div>
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
    <section className="mt-12">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold text-ink-950">
        <span className="h-4 w-1 rounded-full bg-brand-600" aria-hidden="true" />
        {title}
      </h2>
      <div className="text-sm leading-6 text-zinc-700">{children}</div>
    </section>
  );
}

function Missing({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-3 text-[13px] text-zinc-500">
      {text}
    </p>
  );
}

function CountryGroup({
  label,
  hint,
  items,
}: {
  label: string;
  hint: string;
  items: {
    id: string;
    status: string;
    country: { code: string; name: string };
  }[];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="text-[13px] font-semibold text-ink-950">{label}</h3>
      <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-3 rounded-md bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-500">
          Not disclosed
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <Link
                href={`/countries/${i.country.code.toLowerCase()}`}
                className="truncate text-[13px] text-zinc-700 transition-colors hover:text-brand-700"
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
