import { Suspense } from "react";
import type { Metadata } from "next";
import { ProviderCard } from "@/components/provider-card";
import { getPublishedProviders } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Business Formation Services",
  description:
    "Company formation and registered-agent services — useful when a payment provider requires a locally registered entity.",
  path: "/business-formation",
});

export default function BusinessFormationPage() {
  return (
    <main>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-7 pt-10">
          <h1 className="text-[28px] font-bold tracking-tight text-ink-950">
            Business formation services
          </h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-zinc-600">
            Many payment providers require a registered entity in a supported
            country. These services help form companies, provide registered
            agents, and supply the documents providers ask for during
            underwriting.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-7">
        <Suspense fallback={null}>
          <List />
        </Suspense>
      </div>
    </main>
  );
}

async function List() {
  const all = await getPublishedProviders();
  const providers = all.filter((p) => p.category === "formation");
  if (providers.length === 0) {
    return (
      <p className="mt-6 text-sm text-zinc-500">
        No formation services published yet.
      </p>
    );
  }
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} />
      ))}
    </div>
  );
}
