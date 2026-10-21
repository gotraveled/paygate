import { db } from "@/lib/db";
import { fetchPage } from "./fetcher";
import {
  extractPage,
  sectionsFor,
  relevantInternalLinks,
  affiliateLinks,
  findFeeMentions,
  findCountryMentions,
} from "./extract";
import { upsertSource, recordEvidence, autoStatus } from "./evidence";
import type { JobContext } from "./runner";

/**
 * Agent B — Provider research.
 *
 * For a provider, fetches official pages (homepage + discovered internal
 * doc/pricing/legal pages), extracts candidate claims, and stores them as
 * Evidence rows with a Source row and retrieval date. Nothing is published;
 * statuses stay conservative until verification upgrades them.
 */

const MAX_PAGES_PER_PROVIDER = 12;

export async function runResearch(ctx: JobContext) {
  const providerId = ctx.payload.providerId as string | undefined;
  if (!providerId) throw new Error("providerId required");

  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) throw new Error(`provider ${providerId} not found`);

  const visited = new Set<string>();
  const queue: string[] = [provider.websiteUrl];
  let pagesFetched = 0;
  let evidenceCreated = 0;

  while (queue.length > 0 && pagesFetched < MAX_PAGES_PER_PROVIDER) {
    const url = queue.shift()!;
    const clean = url.split("#")[0];
    if (visited.has(clean)) continue;
    visited.add(clean);

    const res = await fetchPage(clean);
    if (res.error || res.status !== 200 || !res.contentType.includes("html")) {
      await ctx.log(`skip ${clean}`, { status: res.status, error: res.error });
      continue;
    }
    pagesFetched++;

    const page = extractPage(res.body, res.finalUrl);
    const source = await upsertSource(clean, res, {
      title: page.title,
      providerId: provider.id,
    });

    // ---- Candidate claims -------------------------------------------------

    // Pricing mentions
    const pricingSections = sectionsFor(page, "pricing");
    for (const s of pricingSections) {
      const fees = findFeeMentions(s.text);
      for (const fee of fees.slice(0, 4)) {
        await recordEvidence({
          providerId: provider.id,
          field: "pricing.mention",
          claim: `Possible published fee: "${fee}"`,
          value: { context: fee, heading: s.heading },
          status: autoStatus({
            officialSource: true,
            method: "pattern",
            confidence: 0.5,
          }),
          method: "pattern",
          confidence: 0.5,
          sourceId: source.id,
        });
        evidenceCreated++;
      }
    }

    // Country availability mentions
    const countrySections = sectionsFor(page, "countries");
    for (const s of countrySections) {
      const countries = findCountryMentions(s.text);
      if (countries.length > 0) {
        await recordEvidence({
          providerId: provider.id,
          field: "countries.mentioned",
          claim: `Countries mentioned on ${page.title}: ${countries.join(", ")}`,
          value: { codes: countries, heading: s.heading },
          status: "unverified", // mention != support — stays unverified
          method: "pattern",
          confidence: 0.4,
          sourceId: source.id,
        });
        evidenceCreated++;
      }
    }

    // Prohibited business signals
    const prohibitedSections = sectionsFor(page, "prohibited");
    for (const s of prohibitedSections.slice(0, 2)) {
      await recordEvidence({
        providerId: provider.id,
        field: "industries.policy",
        claim: `Policy section found: "${s.heading}"`,
        value: { excerpt: s.text.slice(0, 600), heading: s.heading },
        status: "unverified",
        method: "pattern",
        confidence: 0.45,
        sourceId: source.id,
      });
      evidenceCreated++;
    }

    // Reserve/payout signals
    for (const s of sectionsFor(page, "payouts").slice(0, 2)) {
      await recordEvidence({
        providerId: provider.id,
        field: "payouts.policy",
        claim: `Payout/reserve section: "${s.heading}"`,
        value: { excerpt: s.text.slice(0, 600), heading: s.heading },
        status: "unverified",
        method: "pattern",
        confidence: 0.45,
        sourceId: source.id,
      });
      evidenceCreated++;
    }

    // Affiliate program discovery (feeds Agent E)
    for (const aff of affiliateLinks(page)) {
      await db.affiliateProgram.upsert({
        where: { id: `aff-${provider.id}` },
        create: {
          id: `aff-${provider.id}`,
          providerId: provider.id,
          companyName: provider.name,
          programUrl: aff,
          status: "discovered",
          lastVerifiedAt: new Date(),
        },
        update: { programUrl: aff, lastVerifiedAt: new Date() },
      });
    }

    // Queue more internal pages that likely contain documentation
    for (const link of relevantInternalLinks(page, res.finalUrl)) {
      if (!visited.has(link.split("#")[0]) && queue.length < 25) {
        queue.push(link);
      }
    }
  }

  // Provider keeps moving forward even if some pages failed.
  await db.provider.update({
    where: { id: provider.id },
    data: { updatedAt: new Date() },
  });

  await ctx.log(`researched ${provider.name}`, {
    pagesFetched,
    evidenceCreated,
  });
  return { pagesFetched, evidenceCreated };
}
