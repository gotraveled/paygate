import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { getIndustries } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Industries — Payment Provider Acceptance",
  description:
    "Which payment providers accept your industry — from SaaS and ecommerce to high-risk categories like supplements, forex, and gaming.",
  path: "/industries",
});

export default function IndustriesPage() {
  return (
    <main>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-7 pt-10">
          <h1 className="text-[28px] font-bold tracking-tight text-ink-950">
            Industries
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-zinc-600">
            Industry acceptance is one of the most common reasons
            applications are declined. Statuses are evidence-based:
            accepted, conditional, restricted, prohibited, or unverified.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-7">
        <Suspense fallback={null}>
          <IndustryGrid />
        </Suspense>
      </div>
    </main>
  );
}

async function IndustryGrid() {
  const industries = await getIndustries();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {industries.map((i) => (
        <Link
          key={i.id}
          href={`/industries/${i.slug}`}
          className="pg-lift rounded-xl border border-zinc-200 bg-white p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-semibold text-ink-950">{i.name}</span>
            {i.riskLevel !== "standard" && (
              <Badge
                variant={i.riskLevel === "high" ? "danger" : "warning"}
              >
                {i.riskLevel} risk
              </Badge>
            )}
          </div>
          {i.summary && (
            <p className="mt-1.5 text-xs leading-4 text-zinc-500 line-clamp-2">
              {i.summary}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
