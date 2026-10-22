import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { CATEGORY_LABELS } from "@/lib/constants";
import { getPublishedProviders } from "@/lib/queries";
import { asStringArray } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Compare Payment Providers",
  description:
    "Side-by-side comparison of payment providers: fees, eligibility, industries, and payout terms from official sources.",
  path: "/compare",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-7 pt-10">
          <h1 className="text-[28px] font-bold tracking-tight text-ink-950">
            Compare providers
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-zinc-600">
            Pick up to three providers for a fact-based side-by-side
            comparison — sourced eligibility, fees, and industry acceptance
            only. Suitability depends on your country and business; no
            provider is universally best.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-7">
        <Suspense fallback={null}>
          <Picker searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={null}>
          <Table searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Picker({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const providers = await getPublishedProviders();
  const sel = [sp.a, sp.b, sp.c].map((v) => (Array.isArray(v) ? v[0] : v ?? ""));
  return (
    <form
      method="get"
      action="/compare"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      {(["a", "b", "c"] as const).map((key, i) => (
        <label key={key} className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Provider {i + 1}
          </span>
          <Select name={key} defaultValue={sel[i]} className="w-44">
            <option value="">— choose —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
      ))}
      <Button type="submit">Compare</Button>
    </form>
  );
}

async function Table({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const slugs = [sp.a, sp.b, sp.c]
    .map((v) => (Array.isArray(v) ? v[0] : v))
    .filter((v): v is string => !!v);
  if (slugs.length < 2) return null;

  const all = await getPublishedProviders();
  const providers = slugs
    .map((s) => all.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => !!p);
  if (providers.length < 2) return null;

  const feeLabel = (p: (typeof providers)[number]) => {
    const fee = p.pricing.find((t) => t.kind === "transaction_pct");
    return fee
      ? `${fee.amountMin ?? "?"}%${fee.conditions ? ` — ${fee.conditions}` : ""}`
      : "Not disclosed";
  };
  const applyCountries = (p: (typeof providers)[number]) =>
    p.countries.filter(
      (c) => c.scope === "merchant_apply" && c.status === "supported"
    );

  const rows: { label: string; render: (p: (typeof providers)[number]) => React.ReactNode }[] = [
    {
      label: "Headline transaction fee",
      render: (p) => feeLabel(p),
    },
    {
      label: "Merchants can apply from",
      render: (p) =>
        applyCountries(p).length
          ? applyCountries(p)
              .map((c) => c.country.name)
              .join(", ")
          : "Not disclosed",
    },
    {
      label: "Payment types",
      render: (p) =>
        asStringArray(p.paymentTypes).join(", ") || "Not disclosed",
    },
    {
      label: "Industries accepted",
      render: (p) =>
        p.industries
          .filter((i) => i.status === "supported")
          .map((i) => i.industry.name)
          .join(", ") || "None verified",
    },
    {
      label: "Industries restricted/prohibited",
      render: (p) =>
        p.industries
          .filter((i) => ["restricted", "prohibited"].includes(i.status))
          .map((i) => `${i.industry.name} (${i.status})`)
          .join(", ") || "None recorded",
    },
    {
      label: "Verification",
      render: (p) =>
        p.lastVerifiedAt ? (
          <StatusBadge status="supported" />
        ) : (
          <StatusBadge status="unverified" />
        ),
    },
  ];

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-ink-950">
            <th className="w-48 p-4 text-xs font-semibold uppercase tracking-wide text-ink-300">
              Field
            </th>
            {providers.map((p) => (
              <th key={p.id} className="p-4 align-middle">
                <Link
                  href={`/providers/${p.slug}`}
                  className="text-[15px] font-semibold text-white transition-colors hover:text-brand-300"
                >
                  {p.name}
                </Link>
                <span className="mt-0.5 block text-[11px] font-normal text-ink-400">
                  {CATEGORY_LABELS[p.category] ?? p.category}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-zinc-100 align-top last:border-0">
              <td className="p-4 text-[13px] font-semibold text-ink-900">{row.label}</td>
              {providers.map((p) => (
                <td key={p.id} className="p-4 text-[13px] leading-5 text-zinc-600">
                  {row.render(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-zinc-100 p-4 text-xs leading-5 text-zinc-500">
        Comparisons use the same sourced data shown on each provider profile.
        Blank or &quot;not disclosed&quot; means no official evidence is on
        file — never an assumption.
      </p>
    </div>
  );
}
