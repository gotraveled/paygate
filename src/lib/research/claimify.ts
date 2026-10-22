import { db } from "@/lib/db";
import type { JobContext } from "./runner";

/**
 * Claim verification — the stage the audit found missing.
 *
 * Research stores raw evidence (mentions, excerpts). This stage reconciles
 * that evidence with STRUCTURED claims (country eligibility, industries,
 * pricing terms, reserve terms, features) without silently overwriting.
 *
 * Rules:
 *  - A number or keyword on an official page is a CANDIDATE, not verification.
 *  - High-impact claims (merchant-country eligibility, industries, pricing,
 *    reserves) auto-promote at most to `conditional`; `supported` requires
 *    corroboration from >=2 independent official sources or manual evidence.
 *  - Same value -> refresh the evidenceId link only.
 *  - Different value -> mark `conflicting` + ReviewItem; never overwrite.
 *  - Fetch/JS/blocked failures produce no claim changes (unresolved, not "no").
 *  - `undisclosed` is only used when an official page that would be expected
 *    to state a fact does not — never inferred from a failed fetch.
 */

const AVAILABILITY_URL = /global|countries|supported|availab|where.*work|region/i;
const PRICING_URL = /pricing|fees?|rates/i;
const PAYOUT_URL = /payout|settle|withdraw|reserve/i;

const FEE_PAIR =
  /(\d+(?:\.\d+)?)\s*%\s*(?:\+\s*([A-Z]{0,3}\$?)\s?(\d+(?:\.\d+)?)\s*(¢|cents?|[A-Z]{3})?)?/;
const DAYS = /T\+\s?(\d+)|(\d+)\s*business days?/i;

interface ProposedClaim {
  status: string;
  confidence: number;
  reason: string;
  evidenceId?: string;
  conditions?: string;
}

interface ReconcileResult {
  action:
    | "created"
    | "refreshed"
    | "promoted"
    | "conflict"
    | "review_only" // evidence disagrees with a manually-verified claim — flag, don't demote
    | "unchanged";
  review?: string;
}

/** Status a proposal is allowed to reach without corroboration/review. */
export function capStatus(status: string, corroborated: boolean, highImpact: boolean) {
  if (!highImpact) return status;
  if (status === "supported") return corroborated ? "supported" : "conditional";
  return status;
}

/** Sources count: evidence rows from distinct sources asserting the same thing. */
export function corroborationScore(evidenceCount: number): number {
  if (evidenceCount >= 3) return 0.9;
  if (evidenceCount === 2) return 0.8;
  return 0.55;
}

/**
 * Pure decision: given an existing claim row (or none) and an evidence-backed
 * proposal, what should happen? Kept side-effect-free so it can be unit-tested
 * without a database.
 */
export function decideCountryAction(
  existing: {
    status: string;
    evidenceId?: string | null;
    confidence?: number | null;
    verifiedBy?: string | null;
  } | null,
  proposed: ProposedClaim
): ReconcileResult["action"] {
  if (!existing) return "created";

  const AFFIRMATIVE = new Set(["supported", "conditional"]);
  const storedPositive = AFFIRMATIVE.has(existing.status);
  const proposedPositive = AFFIRMATIVE.has(proposed.status);

  if (existing.status === proposed.status || (storedPositive && proposedPositive)) {
    // Weak agreement or same status — refresh the evidence link if newer.
    return proposed.evidenceId &&
      (existing.evidenceId !== proposed.evidenceId ||
        (existing.confidence ?? 0) < proposed.confidence)
      ? "refreshed"
      : "unchanged";
  }

  const WEAK = new Set(["unverified", "undisclosed"]);
  const STRONG = new Set(["supported", "conditional"]);
  if (WEAK.has(existing.status) && STRONG.has(proposed.status)) return "promoted";

  // A manually-verified claim is never silently demoted by automation —
  // disagreeing evidence goes to review while the verified status stands.
  if (existing.verifiedBy) return "review_only";

  return "conflict";
}

async function reconcileCountry(opts: {
  providerId: string;
  code: string;
  scope: string;
  proposed: ProposedClaim;
}): Promise<ReconcileResult> {
  const { providerId, code, scope, proposed } = opts;
  const existing = await db.providerCountryEligibility.findFirst({
    where: { providerId, countryCode: code, scope },
  });

  const action = decideCountryAction(existing, proposed);

  if (action === "created") {
    await db.providerCountryEligibility.create({
      data: {
        providerId,
        countryCode: code,
        scope,
        status: proposed.status,
        notes: proposed.conditions,
        evidenceId: proposed.evidenceId,
        statusReason: proposed.reason,
        confidence: proposed.confidence,
      },
    });
    return { action: "created" };
  }

  if (action === "refreshed") {
    await db.providerCountryEligibility.update({
      where: { id: existing!.id },
      data: {
        evidenceId: proposed.evidenceId,
        confidence: Math.max(proposed.confidence, existing!.confidence ?? 0),
      },
    });
    return { action: "refreshed" };
  }

  if (action === "unchanged") return { action: "unchanged" };

  if (action === "promoted") {
    await db.providerCountryEligibility.update({
      where: { id: existing!.id },
      data: {
        status: proposed.status,
        notes: proposed.conditions ?? existing!.notes,
        evidenceId: proposed.evidenceId,
        statusReason: proposed.reason,
        confidence: proposed.confidence,
      },
    });
    return { action: "promoted" };
  }

  if (action === "review_only") {
    // Verified claim stands; the disagreement goes to review so a human can
    // decide whether new evidence should change the status.
    return {
      action: "review_only",
      review: `Evidence disagrees with verified claim (${code}/${scope}): verified "${existing!.status}" vs proposed "${proposed.status}" — ${proposed.reason}`,
    };
  }

  // Genuine disagreement — flag for review, keep existing status recorded
  // as conflicting so the writer renders it honestly as unresolved.
  await db.providerCountryEligibility.update({
    where: { id: existing!.id },
    data: {
      status: "conflicting",
      evidenceId: proposed.evidenceId,
      statusReason: `Stored "${existing!.status}" vs evidence-proposed "${proposed.status}"`,
      confidence: proposed.confidence,
    },
  });
  return {
    action: "conflict",
    review: `Country claim conflict (${code}/${scope}): stored "${existing!.status}" vs proposed "${proposed.status}" — ${proposed.reason}`,
  };
}

export async function runClaimify(ctx: JobContext) {
  const providerId = ctx.payload.providerId as string | undefined;

  const providers = await db.provider.findMany({
    where: providerId ? { id: providerId } : { evidence: { some: {} } },
    select: { id: true, slug: true, name: true },
    take: providerId ? 1 : 40,
  });

  const totals = {
    providers: 0,
    created: 0,
    refreshed: 0,
    promoted: 0,
    conflicts: 0,
    reviewItems: 0,
  };

  for (const provider of providers) {
    totals.providers++;
    const evidence = await db.evidence.findMany({
      where: { providerId: provider.id, status: { not: "outdated" } },
      include: { source: true },
    });

    const reviews: string[] = [];

    // ---- Merchant-application country eligibility -------------------------
    // Only availability-listing pages count. A country name appearing on a
    // random page is a mention, not eligibility.
    const availability = evidence.filter(
      (e) =>
        e.field === "countries.mentioned" &&
        e.source &&
        (AVAILABILITY_URL.test(e.source.url) ||
          AVAILABILITY_URL.test(e.source.finalUrl ?? ""))
    );

    // Count independent corroborating sources per country code.
    const codesBySource = new Map<string, Set<string>>();
    for (const e of availability) {
      const codes = (e.value as { codes?: string[] } | null)?.codes ?? [];
      for (const c of codes) {
        const s = codesBySource.get(c) ?? new Set<string>();
        s.add(e.sourceId ?? "none");
        codesBySource.set(c, s);
      }
    }

    // Latest evidence row per code (for linking).
    const latestEv = new Map<string, (typeof evidence)[number]>();
    for (const e of availability) {
      const codes = (e.value as { codes?: string[] } | null)?.codes ?? [];
      for (const c of codes) latestEv.set(c, e);
    }

    for (const [code, srcs] of codesBySource) {
      const ev = latestEv.get(code);
      const corroborated = srcs.size >= 2;
      const proposed: ProposedClaim = {
        status: capStatus("supported", corroborated, true),
        confidence: corroborationScore(srcs.size),
        reason: corroborated
          ? `${srcs.size} independent official availability pages list ${code}`
          : `single official availability page lists ${code}; pending corroboration`,
        evidenceId: ev?.id,
      };
      const r = await reconcileCountry({
        providerId: provider.id,
        code,
        scope: "merchant_apply",
        proposed,
      });
      if (r.action === "created") totals.created++;
      else if (r.action === "refreshed") totals.refreshed++;
      else if (r.action === "promoted") totals.promoted++;
      else if (r.action === "conflict") {
        totals.conflicts++;
        if (r.review) reviews.push(r.review);
      } else if (r.action === "review_only") {
        if (r.review) reviews.push(r.review);
      }
    }

    // ---- Pricing candidates ----------------------------------------------
    // Extract clean fee patterns from pricing-page evidence. These stay
    // `unverified` candidates — a regex match is not verification.
    const feeEvidence = evidence.filter(
      (e) =>
        e.field === "pricing.mention" &&
        e.source &&
        (PRICING_URL.test(e.source.url) ||
          PRICING_URL.test(e.source.finalUrl ?? ""))
    );

    const feeCandidates = new Map<string, { ctx: string; ev: (typeof evidence)[number] }>();
    for (const e of feeEvidence) {
      const ctxs = Array.isArray(e.value)
        ? (e.value as { context?: string }[])
        : [(e.value ?? {}) as { context?: string }];
      for (const c of ctxs) {
        const text = c.context ?? "";
        const m = text.match(FEE_PAIR);
        if (!m) continue;
        const pct = parseFloat(m[1]);
        if (pct <= 0 || pct > 25) continue; // implausible as a card-processing fee
        const key = `pct:${pct}`;
        if (!feeCandidates.has(key)) feeCandidates.set(key, { ctx: text, ev: e });
      }
    }

    for (const [, cand] of feeCandidates) {
      const m = cand.ctx.match(FEE_PAIR)!;
      const pct = parseFloat(m[1]);
      const existing = await db.pricingTerm.findFirst({
        where: {
          providerId: provider.id,
          kind: "transaction_pct",
          amountMin: pct,
        },
      });
      if (existing) {
        if (!existing.evidenceId) {
          await db.pricingTerm.update({
            where: { id: existing.id },
            data: { evidenceId: cand.ev.id },
          });
          totals.refreshed++;
        }
        continue;
      }
      // Candidate term — explicitly unverified; conditions hold the excerpt.
      await db.pricingTerm.create({
        data: {
          providerId: provider.id,
          kind: "transaction_pct",
          label: `Extracted fee candidate (${pct}%)`,
          amountMin: pct,
          unit: "percent",
          conditions: cand.ctx.slice(0, 250),
          evidenceId: cand.ev.id,
          status: "unverified",
          confidence: 0.5,
        },
      });
      totals.created++;
      reviews.push(
        `Unverified pricing candidate on ${provider.name}: ${pct}% — excerpt "${cand.ctx.slice(0, 120)}"`
      );
    }

    // ---- Payout / settlement candidates ----------------------------------
    const payoutEvidence = evidence.filter(
      (e) =>
        e.field === "payouts.policy" &&
        e.source &&
        (PAYOUT_URL.test(e.source.url) ||
          PAYOUT_URL.test(e.source.finalUrl ?? ""))
    );
    for (const e of payoutEvidence.slice(0, 3)) {
      const excerpt = (e.value as { excerpt?: string } | null)?.excerpt ?? "";
      const m = excerpt.match(DAYS);
      if (!m) continue;
      const days = parseInt(m[1] ?? m[2], 10);
      if (!days || days > 30) continue;
      const existing = await db.reservePayoutTerm.findFirst({
        where: {
          providerId: provider.id,
          kind: "payout_schedule",
          daysMin: days,
        },
      });
      if (existing) {
        if (!existing.evidenceId) {
          await db.reservePayoutTerm.update({
            where: { id: existing.id },
            data: { evidenceId: e.id },
          });
          totals.refreshed++;
        }
        continue;
      }
      await db.reservePayoutTerm.create({
        data: {
          providerId: provider.id,
          kind: "payout_schedule",
          summary: `Extracted settlement candidate: ~${days} business day(s)`,
          daysMin: days,
          conditions: excerpt.slice(0, 250),
          evidenceId: e.id,
        },
      });
      totals.created++;
      reviews.push(
        `Unverified payout candidate on ${provider.name}: ~${days} business days`
      );
    }
    // ---- Review queue -----------------------------------------------------
    // Idempotent: an identical open review item is not created twice, so a
    // re-run does not spam the queue with duplicates.
    for (const reason of reviews) {
      const open = await db.reviewItem.findFirst({
        where: {
          entity: "provider",
          entityId: provider.id,
          reason,
          status: "open",
        },
      });
      if (open) continue;
      await db.reviewItem.create({
        data: { entity: "provider", entityId: provider.id, reason },
      });
      totals.reviewItems++;
    }

    await ctx.log(`claimified ${provider.slug}`, {
      created: totals.created,
      conflicts: totals.conflicts,
    });
  }

  return totals;
}
