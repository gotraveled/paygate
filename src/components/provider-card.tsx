import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { CATEGORY_LABELS } from "@/lib/constants";
import { asStringArray } from "@/lib/utils";
import type { ProviderCardData } from "@/lib/queries";

export function ProviderCard({ provider }: { provider: ProviderCardData }) {
  const applyCountries = provider.countries.filter(
    (c) => c.scope === "merchant_apply" && c.status === "supported"
  );
  const headFee = provider.pricing.find((p) => p.kind === "transaction_pct");

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>
            <Link
              href={`/providers/${provider.slug}`}
              className="hover:text-sky-700"
            >
              {provider.name}
            </Link>
          </CardTitle>
          {provider.sponsored && <Badge variant="info">Sponsored</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge variant="secondary">
            {CATEGORY_LABELS[provider.category] ?? provider.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm text-zinc-600">
        {provider.summary && (
          <p className="line-clamp-3">{provider.summary}</p>
        )}
        <dl className="space-y-1 text-xs">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-zinc-500">Apply from</dt>
            <dd className="text-zinc-800">
              {applyCountries.length > 0
                ? applyCountries
                    .slice(0, 6)
                    .map((c) => c.country.name)
                    .join(", ") + (applyCountries.length > 6 ? "…" : "")
                : "Undisclosed"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-zinc-500">Headline fee</dt>
            <dd className="text-zinc-800">
              {headFee
                ? `${headFee.amountMin ?? "?"}%${headFee.conditions ? ` (${headFee.conditions})` : ""}`
                : "See provider"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-zinc-500">Payment types</dt>
            <dd className="text-zinc-800">
              {asStringArray(provider.paymentTypes).join(", ") || "Undisclosed"}
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter>
        <Link
          href={`/providers/${provider.slug}`}
          className="text-sm font-medium text-sky-700 hover:underline"
        >
          Full profile
        </Link>
        {provider.lastVerifiedAt ? (
          <span className="ml-auto text-xs text-zinc-400">
            Verified {provider.lastVerifiedAt.toISOString().slice(0, 10)}
          </span>
        ) : (
          <StatusBadge status="unverified" />
        )}
      </CardFooter>
    </Card>
  );
}
