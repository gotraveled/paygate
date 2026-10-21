import { db } from "@/lib/db";
import { fetchPage } from "./fetcher";
import { extractPage, affiliateLinks } from "./extract";
import type { JobContext } from "./runner";

/**
 * Agent E — Affiliate opportunity discovery.
 *
 * Finds official affiliate/partner/referral pages on provider sites and
 * records them with status `discovered`. Never applies, never claims a
 * partnership exists, never accepts terms. Anything needing user action is
 * flagged `needsUserAction` + a review item.
 */

export async function runAffiliates(ctx: JobContext) {
  const providerId = ctx.payload.providerId as string | undefined;

  const providers = await db.provider.findMany({
    where: providerId ? { id: providerId } : { status: "published" },
    select: { id: true, name: true, websiteUrl: true },
    take: 30,
  });

  let found = 0;
  let updated = 0;

  for (const p of providers) {
    // Look for affiliate pages linked from homepage + common paths
    const res = await fetchPage(p.websiteUrl);
    if (res.error || res.status !== 200) continue;
    const page = extractPage(res.body, res.finalUrl);

    const candidates = affiliateLinks(page);
    // Also probe common program paths on the same host
    const host = new URL(res.finalUrl).origin;
    for (const path of ["/affiliates", "/affiliate", "/partners", "/referral", "/partner-program"]) {
      candidates.push(`${host}${path}`);
    }

    for (const url of [...new Set(candidates)].slice(0, 8)) {
      const probe = await fetchPage(url);
      if (probe.error || probe.status !== 200) continue;
      const probePage = extractPage(probe.body, probe.finalUrl);
      const text = probePage.text.toLowerCase();
      if (!/affiliate|partner|referral|commission/i.test(text)) continue;

      const programId = `aff-${p.id}`;
      const existing = await db.affiliateProgram.findUnique({
        where: { id: programId },
      });
      const commission =
        text.match(/(\d+\s*%\s*(?:commission|revenue|recurring|lifetime))/i)?.[0] ??
        text.match(/commission[:\s]+([^.\n]{5,80})/i)?.[1];

      if (existing) {
        updated++;
        await db.affiliateProgram.update({
          where: { id: programId },
          data: {
            programUrl: probe.finalUrl,
            commission: commission ?? existing.commission,
            status: existing.status === "discovered" ? "researched" : existing.status,
            lastVerifiedAt: new Date(),
          },
        });
      } else {
        found++;
        await db.affiliateProgram.create({
          data: {
            id: programId,
            providerId: p.id,
            companyName: p.name,
            programName: `${p.name} partner program`,
            programUrl: probe.finalUrl,
            commission,
            status: "researched",
            needsUserAction: true,
            lastVerifiedAt: new Date(),
          },
        });
        await db.reviewItem.create({
          data: {
            entity: "affiliate_program",
            entityId: programId,
            reason: `Affiliate program found for ${p.name} — requires your application: ${probe.finalUrl}`,
          },
        });
      }
    }
  }

  await ctx.log("affiliate scan complete", { found, updated });
  return { found, updated };
}
