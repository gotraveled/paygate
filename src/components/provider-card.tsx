import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProviderMark } from "@/components/provider-mark";
import { CATEGORY_LABELS } from "@/lib/constants";
import { asStringArray } from "@/lib/utils";
import type { ProviderCardData } from "@/lib/queries";

export function ProviderCard({ provider }: { provider: ProviderCardData }) {
  const applyCountries = provider.countries.filter(
    (c) => c.scope === "merchant_apply" && c.status === "supported"
  );
  const headFee = provider.pricing.find((p) => p.kind === "transaction_pct");
  const verified = provider.lastVerifiedAt != null;

  return (
    <article className="pg-lift group relative flex h-full flex-col rounded-xl border border-zinc-200 bg-white">
      {/* Click target covers the card; footer has its own link below it via z-index */}
      <Link
        href={`/providers/${provider.slug}`}
        className="absolute inset-0 rounded-xl"
        aria-label={`${provider.name} profile`}
      />
      <div className="flex items-start gap-3 p-5 pb-0">
        <ProviderMark name={provider.name} slug={provider.slug} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-ink-950 group-hover:text-brand-700">
            {provider.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              {CATEGORY_LABELS[provider.category] ?? provider.category}
            </Badge>
            {provider.sponsored && <Badge variant="info">Sponsored</Badge>}
          </div>
        </div>
        {/* Verified = mint, unverified = muted — different visual authority */}
        {verified ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-mint-200 bg-mint-50 px-2 py-0.5 text-[11px] font-semibold text-mint-700"
            title={`Research verified ${provider.lastVerifiedAt!.toISOString().slice(0, 10)}`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1.2 14.6-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z" />
            </svg>
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
            Unverified
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 px-5 py-4">
        {provider.summary && (
          <p className="line-clamp-2 text-[13.5px] leading-5 text-zinc-600">
            {provider.summary}
          </p>
        )}
        <dl className="space-y-1.5 text-xs">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium text-zinc-400">
              Apply from
            </dt>
            <dd className="text-zinc-800">
              {applyCountries.length > 0
                ? applyCountries
                    .slice(0, 5)
                    .map((c) => c.country.name)
                    .join(", ") + (applyCountries.length > 5 ? "…" : "")
                : "Undisclosed"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium text-zinc-400">
              Headline fee
            </dt>
            <dd className="text-zinc-800">
              {headFee
                ? `${headFee.amountMin ?? "?"}%${headFee.conditions ? ` (${headFee.conditions})` : ""}`
                : "See provider"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium text-zinc-400">
              Payments
            </dt>
            <dd className="text-zinc-800">
              {asStringArray(provider.paymentTypes).slice(0, 3).join(", ") ||
                "Undisclosed"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-zinc-100 px-5 py-3">
        <Link
          href={`/providers/${provider.slug}`}
          className="text-[13px] font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          Full profile <span aria-hidden="true">→</span>
        </Link>
        {verified && (
          <span className="text-[11px] text-zinc-400">
            Verified {provider.lastVerifiedAt!.toISOString().slice(0, 10)}
          </span>
        )}
      </div>
    </article>
  );
}
