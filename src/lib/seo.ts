import type { Metadata } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

export function siteUrl(path = ""): string {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}${path}`;
}

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: siteUrl(opts.path) },
    openGraph: {
      title: `${opts.title} | ${SITE_NAME}`,
      description: opts.description,
      url: siteUrl(opts.path),
      siteName: SITE_NAME,
      type: "website",
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl("/"),
    description: SITE_TAGLINE,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: siteUrl(it.path),
    })),
  };
}

export function itemListJsonLd(
  name: string,
  items: { name: string; path: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: siteUrl(it.path),
    })),
  };
}
