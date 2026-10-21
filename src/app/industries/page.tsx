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
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Industries
      </h1>
      <p className="mt-2 max-w-2xl text-zinc-600">
        Industry acceptance is one of the most common reasons applications are
        declined. Statuses are evidence-based: accepted, conditionally
        accepted, restricted, prohibited, or unverified.
      </p>
      <Suspense fallback={null}>
        <IndustryGrid />
      </Suspense>
    </main>
  );
}

async function IndustryGrid() {
  const industries = await getIndustries();
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {industries.map((i) => (
        <Link
          key={i.id}
          href={`/industries/${i.slug}`}
          className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-900"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-900">{i.name}</span>
            {i.riskLevel !== "standard" && (
              <Badge
                variant={i.riskLevel === "high" ? "danger" : "warning"}
              >
                {i.riskLevel} risk
              </Badge>
            )}
          </div>
          {i.summary && (
            <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
              {i.summary}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
