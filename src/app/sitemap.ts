import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "",
    "/providers",
    "/finder",
    "/compare",
    "/countries",
    "/industries",
    "/business-formation",
    "/guides",
    "/about",
    "/editorial-methodology",
    "/affiliate-disclosure",
    "/contact",
    "/privacy",
    "/terms",
  ];

  const [providers, countries, industries, pages] = await Promise.all([
    db.provider.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
    }),
    db.country.findMany({ where: { active: true }, select: { code: true } }),
    db.industry.findMany({ select: { slug: true } }),
    db.contentPage.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    ...staticPaths.map((p) => ({
      url: siteUrl(p),
      changeFrequency: "weekly" as const,
    })),
    ...providers.map((p) => ({
      url: siteUrl(`/providers/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
    })),
    ...countries.map((c) => ({
      url: siteUrl(`/countries/${c.code.toLowerCase()}`),
      changeFrequency: "weekly" as const,
    })),
    ...industries.map((i) => ({
      url: siteUrl(`/industries/${i.slug}`),
      changeFrequency: "weekly" as const,
    })),
    ...pages.map((p) => ({
      url: siteUrl(`/guides/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
    })),
  ];
}
