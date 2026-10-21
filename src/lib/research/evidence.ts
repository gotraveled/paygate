import { db } from "@/lib/db";
import { hostname } from "@/lib/utils";
import type { FetchResult } from "./fetcher";

/**
 * Evidence persistence — every material claim gets a Source row and an
 * Evidence row. Nothing reaches published provider fields without passing
 * through here first.
 */

export async function upsertSource(
  url: string,
  result: FetchResult,
  opts: { title?: string; providerId?: string; sourceType?: string } = {}
) {
  return db.source.upsert({
    where: { url },
    create: {
      url,
      host: hostname(url),
      title: opts.title,
      providerId: opts.providerId,
      sourceType: opts.sourceType ?? "official",
      lastFetchedAt: result.fetchedAt,
      contentHash: result.hash,
      httpStatus: result.status,
      active: result.status >= 200 && result.status < 400,
    },
    update: {
      title: opts.title ?? undefined,
      lastFetchedAt: result.fetchedAt,
      contentHash: result.hash,
      httpStatus: result.status,
      active: result.status >= 200 && result.status < 400,
    },
  });
}

export interface EvidenceInput {
  providerId?: string;
  field: string;
  claim: string;
  value?: unknown;
  status?: string;
  method?: "manual" | "pattern" | "seed" | "third_party";
  confidence?: number;
  sourceId?: string;
}

export async function recordEvidence(input: EvidenceInput) {
  // Supersede prior active evidence for the same provider+field that
  // carries a different value — keeps only the newest claim per field.
  if (input.providerId) {
    await db.evidence.updateMany({
      where: {
        providerId: input.providerId,
        field: input.field,
        status: { not: "outdated" },
      },
      data: { status: "outdated" },
    });
  }
  return db.evidence.create({
    data: {
      providerId: input.providerId,
      field: input.field,
      claim: input.claim,
      value: input.value === undefined ? undefined : JSON.parse(JSON.stringify(input.value)),
      status: input.status ?? "unverified",
      extractionMethod: input.method ?? "pattern",
      confidence: input.confidence ?? 0,
      sourceId: input.sourceId,
      retrievedAt: new Date(),
    },
  });
}

/**
 * Conservative auto-verification: only upgrade to a "supported"-class status
 * when the evidence came from an official source AND the extraction method is
 * reliable. Everything else stays unverified for human/pipeline review.
 */
export function autoStatus(opts: {
  officialSource: boolean;
  method: string;
  confidence: number;
}): string {
  if (opts.officialSource && opts.method !== "third_party" && opts.confidence >= 0.7) {
    return "supported";
  }
  if (opts.officialSource && opts.confidence >= 0.4) {
    return "unverified"; // official but weakly extracted — needs review
  }
  return "unverified";
}
