import { db } from "@/lib/db";
import { registerHandler, runJob, type JobContext } from "./runner";
import { runDiscover } from "./discover";
import { runResearch } from "./research";
import { runClaimify } from "./claimify";
import { runVerify } from "./verify";
import { runContent } from "./content";
import { runAffiliates } from "./affiliates";
import { runReport } from "./report";
import { notify } from "./notify";
import { revalidateTag } from "next/cache";
import type { JobType } from "@/lib/constants";

export { enqueue, execute, runJob, drain } from "./runner";

/**
 * Register all agent handlers and expose a simple orchestration API used by
 * the cron route and CLI scripts.
 */

registerHandler("discover", (ctx) => runDiscover(ctx).then(() => {}));
registerHandler("research", (ctx) => runResearch(ctx).then(() => {}));
registerHandler("claimify", (ctx) => runClaimify(ctx).then(() => {}));
registerHandler("verify", (ctx) => runVerify(ctx).then(() => {}));
registerHandler("content", (ctx) => runContent(ctx).then(() => {}));
registerHandler("affiliates", (ctx) => runAffiliates(ctx).then(() => {}));
registerHandler("report", (ctx) => runReport(ctx).then(() => {}));

/** Fan-out orchestrator: queue per-provider research for unverified providers. */
export async function scheduleResearch(limit = 20) {
  const stale = await db.provider.findMany({
    where: {
      OR: [{ lastVerifiedAt: null }, { status: "draft" }],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const results = [];
  for (const p of stale) {
    results.push(await runJob("research", { providerId: p.id }));
  }
  return results;
}

/** Sweep sources older than a threshold through the verify agent. */
export async function scheduleVerification() {
  return runJob("verify", {});
}

/**
 * Draft content pages for providers whose facts are verified enough to write
 * from. The gate is verified claim coverage — a provider needs at least one
 * supported/conditional country eligibility or industry claim plus some
 * evidence — not the old `evidence.status = "supported"` check the pipeline
 * never produced.
 */
export async function scheduleContent(limit = 10) {
  const providers = await db.provider.findMany({
    where: {
      status: "published",
      evidence: { some: { status: { not: "outdated" } } },
      OR: [
        { countries: { some: { status: { in: ["supported", "conditional"] } } } },
        { industries: { some: { status: { in: ["supported", "conditional", "restricted"] } } } },
      ],
    },
    select: { id: true },
    take: limit,
  });
  const results = [];
  for (const p of providers) {
    results.push(await runJob("content", { providerId: p.id }));
  }
  return results;
}

/** Revalidate public caches after research writes land. */
export function refreshPublicCache() {
  try {
    revalidateTag("providers", "max");
    revalidateTag("countries", "max");
    revalidateTag("industries", "max");
    revalidateTag("pages", "max");
  } catch {
    // revalidateTag outside a request context is a no-op
  }
}

export async function dailyPipeline() {
  const out: Record<string, unknown> = {};
  out.research = await scheduleResearch(10);
  out.claimify = await runJob("claimify", {});
  out.verify = await scheduleVerification();
  out.content = await scheduleContent(5);
  out.affiliates = await runJob("affiliates", {});
  out.report = await runJob("report", {});
  refreshPublicCache();
  await notify("info", "Daily pipeline completed", out);
  return out;
}

export type { JobContext, JobType };
