import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Markdown } from "@/lib/markdown";
import { getPublishedPage } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return { title: "Not found" };
  return pageMetadata({
    title: page.title,
    description: page.summary ?? page.title,
    path: `/guides/${slug}`,
  });
}

export default function GuidePage({ params }: { params: Params }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </main>
  );
}

async function Body({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page || page.status !== "published") notFound();

  return (
    <article>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{page.type}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">
        {page.title}
      </h1>
      {page.publishedAt && (
        <p className="mt-2 text-sm text-zinc-500">
          Published {formatDate(page.publishedAt)}
          {page.provider ? ` · covers ${page.provider.name}` : ""}
        </p>
      )}
      <div className="mt-8">
        <Markdown source={page.body} />
      </div>
      <p className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        This article is generated from our verified provider database and
        reviewed under our{" "}
        <a href="/editorial-methodology" className="underline">
          editorial methodology
        </a>
        .
      </p>
    </article>
  );
}
