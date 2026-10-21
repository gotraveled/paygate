import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import type { SupportStatus } from "@/lib/constants";

/**
 * Read helpers for public pages. All results are cached — directory data
 * changes at most a few times per day, and `revalidateTag("providers")`
 * is called by research jobs when material changes are applied.
 */

const HOURS = "hours" as const;

export async function getPublishedProviders() {
  "use cache";
  cacheLife(HOURS);
  cacheTag("providers");
  return db.provider.findMany({
    where: { status: "published" },
    include: {
      countries: { include: { country: true } },
      industries: { include: { industry: true } },
      pricing: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getProviderBySlug(slug: string) {
  "use cache";
  cacheLife(HOURS);
  cacheTag("providers", `provider-${slug}`);
  return db.provider.findUnique({
    where: { slug },
    include: {
      countries: { include: { country: true } },
      industries: { include: { industry: true } },
      pricing: { orderBy: { kind: "asc" } },
      reserves: true,
      features: true,
      evidence: {
        where: { status: { not: "outdated" } },
        include: { source: true },
        orderBy: { retrievedAt: "desc" },
      },
      affiliates: true,
    },
  });
}

export async function getCountries() {
  "use cache";
  cacheLife(HOURS);
  cacheTag("countries");
  return db.country.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getCountry(code: string) {
  "use cache";
  cacheLife(HOURS);
  cacheTag("countries", `country-${code}`);
  return db.country.findUnique({ where: { code } });
}

export async function getIndustries() {
  "use cache";
  cacheLife(HOURS);
  cacheTag("industries");
  return db.industry.findMany({
    where: { vertical: "payments" },
    orderBy: { name: "asc" },
  });
}

export async function getIndustry(slug: string) {
  "use cache";
  cacheLife(HOURS);
  cacheTag("industries", `industry-${slug}`);
  return db.industry.findUnique({ where: { slug } });
}

export async function getProvidersForCountry(code: string) {
  "use cache";
  cacheLife(HOURS);
  cacheTag("providers", `country-${code}`);
  return db.provider.findMany({
    where: {
      status: "published",
      countries: {
        some: {
          countryCode: code,
          scope: "merchant_apply",
          status: { in: ["supported", "conditional", "unverified"] },
        },
      },
    },
    include: {
      countries: {
        where: { countryCode: code },
        include: { country: true },
      },
      industries: { include: { industry: true } },
      pricing: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getProvidersForIndustry(slug: string) {
  "use cache";
  cacheLife(HOURS);
  cacheTag("providers", `industry-${slug}`);
  const industry = await db.industry.findUnique({ where: { slug } });
  if (!industry) return [];
  return db.provider.findMany({
    where: {
      status: "published",
      industries: {
        some: {
          industryId: industry.id,
          status: { in: ["supported", "conditional", "restricted", "unverified"] },
        },
      },
    },
    include: {
      industries: { where: { industryId: industry.id }, include: { industry: true } },
      countries: { include: { country: true } },
      pricing: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getPublishedPages(type?: string) {
  "use cache";
  cacheLife(HOURS);
  cacheTag("pages");
  return db.contentPage.findMany({
    where: { status: "published", ...(type ? { type } : {}) },
    orderBy: { publishedAt: "desc" },
    include: { provider: { select: { slug: true, name: true } } },
  });
}

export async function getPublishedPage(slug: string) {
  "use cache";
  cacheLife(HOURS);
  cacheTag("pages", `page-${slug}`);
  return db.contentPage.findUnique({
    where: { slug },
    include: { provider: true },
  });
}

// -- Uncached, request-time queries (used inside <Suspense>) ------------------

export async function searchProviders(opts: {
  q?: string;
  category?: string;
  country?: string;
  industry?: string;
}) {
  const { q, category, country, industry } = opts;
  return db.provider.findMany({
    where: {
      status: "published",
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { summary: { contains: q } },
            ],
          }
        : {}),
      ...(category ? { category } : {}),
      ...(country
        ? {
            countries: {
              some: { countryCode: country, scope: "merchant_apply" },
            },
          }
        : {}),
      ...(industry
        ? { industries: { some: { industry: { slug: industry } } } }
        : {}),
    },
    include: {
      countries: { include: { country: true } },
      industries: { include: { industry: true } },
      pricing: true,
    },
    orderBy: { name: "asc" },
    take: 100,
  });
}

export type ProviderCardData = Awaited<
  ReturnType<typeof getPublishedProviders>
>[number];

export function countryStatus(
  eligibilities: { scope: string; status: string }[],
  scope: string
): SupportStatus | null {
  const hit = eligibilities.find((e) => e.scope === scope);
  return hit ? (hit.status as SupportStatus) : null;
}
