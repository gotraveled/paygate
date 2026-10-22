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

/**
 * Page types that never produce eligibility/policy/pricing evidence.
 * Marketing/editorial content is not an authoritative record of what a
 * provider accepts — blog posts and partner directories cite other parties.
 * Legal pages are kept: acceptable-use and restriction policies live there.
 * Affiliate discovery still runs on every fetched page.
 */
export const NON_EVIDENCE_PATH =
  /(?:^|\/)(blog|news|newsroom|press|events|stories|guides?|learn|academy|partners?\/(?:directory|portal)|customers?|case-stud(?:y|ies)|community|careers?|jobs?|support|help|solutions?)(?:\/|$)/i;

/** Editorial/community subdomains are not provider documentation. `docs.` stays. */
const NON_EVIDENCE_HOST = /^(help|support|community|blog|news|status|developers\.community)\./i;

export function isEvidencePath(url: string): boolean {
  try {
    const u = new URL(url);
    if (NON_EVIDENCE_HOST.test(u.hostname)) return false;
    return !NON_EVIDENCE_PATH.test(u.pathname);
  } catch {
    return true;
  }
}

/**
 * Headings that genuinely describe payout/settlement/reserve terms.
 * Bare `withdraw` matched "Withdrawal of Consent for Electronic
 * Communications"; bare `reserve` matched "we reserve the right". Require
 * settlement vocabulary that cannot appear in unrelated legal boilerplate.
 */
export const PAYOUT_HEADING =
  /payout|pay ?out|settle|rolling reserve|reserve (balance|requirement|fund)|disburse|remittance|funds? (transfer|hold)|when (do|will) i get paid|getting paid/i;

/** Headings that genuinely describe business/acceptable-use policy. */
export const POLICY_HEADING =
  /prohibit|restrict|accept(ed|able) (use|business)|banned|not (supported|permitted)|ineligible|business categor|high.?risk|acceptable use/i;

/** Legal-structure headings that are never policy content even if they match. */
export const GENERIC_HEADING =
  /definitions?|interpretation|overview|introduction|consent|termination|liabilit|indemnif|governing|dispute|arbitration|force majeure|assignment|severability|waiver|notices?|ownership|editing|deleting|modification|dormant/i;

export async function runResearch(ctx: JobContext) {
  const providerId = ctx.payload.providerId as string | undefined;
  if (!providerId) throw new Error("providerId required");
  // Optional explicit URLs — useful when geo-redirects or nav structure keep
  // the crawler from reaching key docs (availability, pricing, legal).
  const extraUrls = Array.isArray(ctx.payload.urls)
    ? (ctx.payload.urls as string[])
    : [];

  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) throw new Error(`provider ${providerId} not found`);

  // Availability pages spell out country names; build name→code from the
  // directory's own Country table so real availability lists produce codes.
  const countries = await db.country.findMany({
    select: { code: true, name: true },
  });
  const countryNameMap = Object.fromEntries(
    countries.map((c) => [c.name.toLowerCase(), c.code])
  );

  const visited = new Set<string>();
  const queue: string[] = [...extraUrls, provider.websiteUrl];
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

    // Blog, partner-directory, help and community pages cite other parties'
      // terms and list countries incidentally — they are not authoritative
      // provider records and never produce evidence. Affiliate discovery
      // still runs on every fetched page.
    const evidencePage = isEvidencePath(res.finalUrl || clean);

    // ---- Candidate claims -------------------------------------------------

    // Pricing mentions
    const pricingSections = evidencePage ? sectionsFor(page, "pricing") : [];
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

    // Country availability mentions — map country NAMES to ISO2 using the
    // directory's Country table (availability lists spell out names).
    // Sections catch heading-labeled lists; the full-text scan catches
    // list-style pages (e.g. /global) whose list sits under a generic heading.
    const pageCodes = new Set<string>();
    let allCodes: string[] = [];
    if (evidencePage) {
      const countrySections = sectionsFor(page, "countries");
      for (const s of countrySections) {
        const codes = findCountryMentions(s.text, countryNameMap);
        // A lone country name in a section is incidental (e.g. a licenses
        // page naming one jurisdiction); a list needs at least two.
        if (codes.length >= 2) for (const c of codes) pageCodes.add(c);
      }
      allCodes = findCountryMentions(page.text, countryNameMap);
      if (allCodes.length >= 5) for (const c of allCodes) pageCodes.add(c);
    }
    const countries = [...pageCodes];
    if (countries.length > 0) {
      await recordEvidence({
        providerId: provider.id,
        field: "countries.mentioned",
        claim: `Countries mentioned on ${page.title}: ${countries.join(", ")}`,
        value: {
          codes: countries,
          listLike: allCodes.length >= 5,
        },
        status: "unverified", // mention != support — stays unverified
        method: "pattern",
        confidence: allCodes.length >= 5 ? 0.55 : 0.4,
        sourceId: source.id,
      });
      evidenceCreated++;
    }

    // Prohibited business signals — only sections whose HEADING identifies a
    // policy/prohibited topic count, and only on evidence-worthy page types.
    // A generic section ("Resources") that happens to mention "restrict" in
    // its text is not policy evidence; neither is a legal boilerplate heading.
    const prohibitedSections = evidencePage
      ? sectionsFor(page, "prohibited").filter(
          (s) => POLICY_HEADING.test(s.heading) && !GENERIC_HEADING.test(s.heading)
        )
      : [];
    for (const s of prohibitedSections.slice(0, 2)) {
      await recordEvidence({
        providerId: provider.id,
        field: "industries.policy",
        claim: `Policy section found: "${s.heading}"`,
        value: { excerpt: s.text.slice(0, 600), heading: s.heading },
        status: "unverified",
        method: "pattern",
        confidence: 0.5,
        sourceId: source.id,
      });
      evidenceCreated++;
    }

    // Reserve/payout signals — same heading + page-type requirement.
    const payoutSections = evidencePage
      ? sectionsFor(page, "payouts").filter(
          (s) => PAYOUT_HEADING.test(s.heading) && !GENERIC_HEADING.test(s.heading)
        )
      : [];
    for (const s of payoutSections.slice(0, 2)) {
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

    // Affiliate program discovery (feeds Agent E). Discovery is not approval —
    // every discovered program needs user action until a relationship exists.
    for (const aff of affiliateLinks(page)) {
      await db.affiliateProgram.upsert({
        where: { id: `aff-${provider.id}` },
        create: {
          id: `aff-${provider.id}`,
          providerId: provider.id,
          companyName: provider.name,
          programUrl: aff,
          status: "discovered",
          needsUserAction: true,
          lastVerifiedAt: new Date(),
        },
        update: {
          programUrl: aff,
          lastVerifiedAt: new Date(),
          // Re-flag for action only if the program was never approved.
          needsUserAction: true,
        },
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
