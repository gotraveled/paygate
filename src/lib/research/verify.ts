import { db } from "@/lib/db";
import { fetchPage } from "./fetcher";
import { extractPage, sectionsFor, findFeeMentions } from "./extract";
import { diffValues, recordChange } from "./changes";
import { upsertSource, recordEvidence } from "./evidence";
import type { JobContext } from "./runner";

/**
 * Agent C — Verification & change detection.
 *
 * Re-fetches saved sources on schedule, compares content hash, and when the
 * page changed re-extracts signals and diffs them against stored evidence.
 * - Content unchanged -> just refresh timestamps.
 * - Source broken     -> mark source inactive, create a review item (never
 *                        wipe stored facts).
 * - Content changed   -> re-extract, diff material fields, record ChangeEvents.
 */

export async function runVerify(ctx: JobContext) {
  const sourceId = ctx.payload.sourceId as string | undefined;
  const providerId = ctx.payload.providerId as string | undefined;

  const sources = await db.source.findMany({
    where: {
      ...(sourceId ? { id: sourceId } : {}),
      ...(providerId ? { providerId } : {}),
      active: true,
      ...(sourceId || providerId
        ? {}
        : {
            // Default: only sources fetched >20h ago
            lastFetchedAt: { lt: new Date(Date.now() - 20 * 3600 * 1000) },
          }),
    },
    take: 40,
    orderBy: { lastFetchedAt: "asc" },
  });

  let checked = 0;
  let changed = 0;
  let broken = 0;

  for (const source of sources) {
    const res = await fetchPage(source.url);
    checked++;

    if (res.error || res.status >= 400 || res.status === 0) {
      broken++;
      await db.source.update({
        where: { id: source.id },
        data: { active: false, httpStatus: res.status, lastFetchedAt: res.fetchedAt },
      });
      await db.reviewItem.create({
        data: {
          entity: "evidence",
          entityId: source.id,
          reason: `Source unavailable (${res.status || res.error}): ${source.url}. Stored claims retained for review.`,
        },
      });
      await ctx.log(`source broken: ${source.url}`, { status: res.status });
      continue;
    }

    const hashDiff = diffValues("contentHash", source.contentHash, res.hash);
    if (!hashDiff) {
      await db.source.update({
        where: { id: source.id },
        data: { lastFetchedAt: res.fetchedAt, httpStatus: res.status },
      });
      continue;
    }

    changed++;
    const page = extractPage(res.body, res.finalUrl);
    await upsertSource(source.url, res, {
      title: page.title,
      providerId: source.providerId ?? undefined,
    });

    // Diff material signals against THIS source's own prior evidence.
    // Comparing against the latest provider-level evidence was a bug: every
    // changed page triggered a "significant pricing change" because its
    // mentions never matched some other page's baseline.
    if (source.providerId) {
      const providerId_ = source.providerId;

      const feeSections = sectionsFor(page, "pricing");
      const newFees = feeSections
        .flatMap((s) => findFeeMentions(s.text))
        .slice(0, 8);

      // No fee signals on this page → nothing to diff, don't invent a change.
      if (newFees.length > 0) {
        const oldEvidence = await db.evidence.findFirst({
          where: {
            providerId: providerId_,
            field: "pricing.mention",
            sourceId: source.id,
            status: { not: "outdated" },
          },
          orderBy: { retrievedAt: "desc" },
        });
        const oldFees: unknown[] = Array.isArray(oldEvidence?.value)
          ? (oldEvidence.value as unknown[])
          : oldEvidence?.value
            ? [oldEvidence.value]
            : [];
        const oldContexts = oldFees.map((f) =>
          typeof f === "object" && f && "context" in f
            ? (f as { context: string }).context
            : f
        );
        const diff = oldEvidence
          ? diffValues("pricing", oldContexts, newFees)
          : null; // first-time baseline → record silently, no change event
        if (diff) {
          await recordChange({
            providerId: providerId_,
            diff,
            evidenceClear: false, // pricing is significant — always review
            notes: `Pricing signals changed on ${source.url}`,
          });
        }
        // Refresh the per-source baseline for the next run.
        await recordEvidence({
          providerId: providerId_,
          field: "pricing.mention",
          claim: `Fee signals on ${source.url}: ${newFees.length} mention(s)`,
          value: newFees.map((f) => ({ context: f })),
          status: "unverified",
          method: "pattern",
          confidence: 0.5,
          sourceId: source.id,
        });
      }
    }

    await ctx.log(`changed: ${source.url}`);
  }

  return { checked, changed, broken };
}
