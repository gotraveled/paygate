import { normalizeProviderName, hostname } from "@/lib/utils";
import type { db } from "@/lib/db";

/**
 * Provider deduplication.
 *
 * Two records are the same provider when:
 *   - normalized names match exactly, OR
 *   - domains match exactly, OR
 *   - one normalized name fully contains the other (e.g. "stripe" vs
 *     "stripe payments") AND domains share a registrable base.
 *
 * Conservative on purpose: a false merge is worse than a review queue entry.
 */

type Db = typeof db;

export interface CandidateInput {
  name: string;
  websiteUrl: string;
}

export interface DedupResult {
  action: "create" | "existing" | "ambiguous";
  existingId?: string;
  reason: string;
}

export async function dedupProvider(
  prisma: Db,
  input: CandidateInput
): Promise<DedupResult> {
  const normalized = normalizeProviderName(input.name);
  const domain = hostname(input.websiteUrl);

  if (!normalized || !domain) {
    return { action: "ambiguous", reason: "Cannot normalize name or domain" };
  }

  // Exact normalized-name match
  const byName = await prisma.provider.findUnique({
    where: { normalizedName: normalized },
  });
  if (byName) {
    return {
      action: "existing",
      existingId: byName.id,
      reason: "normalized name match",
    };
  }

  // Domain match
  const byDomain = await prisma.provider.findFirst({
    where: { domain },
  });
  if (byDomain) {
    // Same domain, different name -> almost certainly the same company
    return {
      action: "existing",
      existingId: byDomain.id,
      reason: "domain match",
    };
  }

  // Containment check (weak signal -> human review)
  const candidates = await prisma.provider.findMany({
    where: {
      OR: [
        { normalizedName: { contains: normalized } },
        { name: { contains: input.name } },
      ],
    },
    take: 5,
  });
  const contained = candidates.find(
    (c) =>
      normalized.length >= 4 &&
      (c.normalizedName.includes(normalized) ||
        normalized.includes(c.normalizedName))
  );
  if (contained) {
    return {
      action: "ambiguous",
      existingId: contained.id,
      reason: `possible duplicate of "${contained.name}"`,
    };
  }

  return { action: "create", reason: "no match" };
}
