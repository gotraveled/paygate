import { db } from "@/lib/db";
import { notify } from "./notify";
import type { JobContext } from "./runner";

/**
 * Daily operations report — summarizes the last 24h of pipeline activity and
 * persists it as a Report row (and markdown). Failures are also sent through
 * the notification channel.
 */
export async function runReport(ctx: JobContext) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const [
    providersDiscovered,
    jobsRun,
    jobsFailed,
    changesDetected,
    changesNeedingReview,
    pagesDrafted,
    pagesPublished,
    affiliatesFound,
    affiliatesNeedingAction,
    openReviewItems,
    brokenSources,
    staleProviders,
  ] = await Promise.all([
    db.provider.count({ where: { createdAt: { gte: since } } }),
    db.researchJob.count({ where: { finishedAt: { gte: since } } }),
    db.researchJob.count({
      where: { status: "failed", finishedAt: { gte: since } },
    }),
    db.changeEvent.count({ where: { createdAt: { gte: since } } }),
    db.changeEvent.count({
      where: { status: "needs_review", createdAt: { gte: since } },
    }),
    db.contentPage.count({ where: { createdAt: { gte: since } } }),
    db.contentPage.count({
      where: { status: "published", publishedAt: { gte: since } },
    }),
    db.affiliateProgram.count({ where: { createdAt: { gte: since } } }),
    db.affiliateProgram.count({ where: { needsUserAction: true } }),
    db.reviewItem.count({ where: { status: "open" } }),
    db.source.count({ where: { active: false } }),
    db.provider.count({
      where: {
        status: "published",
        OR: [
          { lastVerifiedAt: null },
          { lastVerifiedAt: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
        ],
      },
    }),
  ]);

  const failedJobs = await db.researchJob.findMany({
    where: { status: "failed", finishedAt: { gte: since } },
    select: { type: true, error: true },
    take: 10,
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    providersDiscovered,
    jobsRun,
    jobsFailed,
    changesDetected,
    changesNeedingReview,
    pagesDrafted,
    pagesPublished,
    affiliatesFound,
    affiliatesNeedingAction,
    openReviewItems,
    brokenSources,
    staleProviders,
    failedJobs: failedJobs.map((j) => `${j.type}: ${j.error}`),
  };

  const body = [
    `# Daily research report — ${summary.generatedAt.slice(0, 10)}`,
    "",
    `- New providers discovered: ${providersDiscovered}`,
    `- Jobs run (24h): ${jobsRun} (${jobsFailed} failed)`,
    `- Material changes detected: ${changesDetected} (${changesNeedingReview} need review)`,
    `- Pages created (24h): ${pagesDrafted}, published: ${pagesPublished}`,
    `- Affiliate programs found (24h): ${affiliatesFound}`,
    `- Affiliate programs needing your action: ${affiliatesNeedingAction}`,
    `- Open review items: ${openReviewItems}`,
    `- Broken official sources: ${brokenSources}`,
    `- Published providers not verified in 30d: ${staleProviders}`,
    failedJobs.length
      ? `\n## Failed jobs\n${failedJobs.map((j) => `- ${j.type}: ${j.error}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const date = new Date().toISOString().slice(0, 10);
  await db.report.upsert({
    where: { date },
    create: { date, summary: JSON.parse(JSON.stringify(summary)), body },
    update: { summary: JSON.parse(JSON.stringify(summary)), body },
  });

  if (jobsFailed > 0 || affiliatesNeedingAction > 0) {
    await notify(
      jobsFailed > 0 ? "error" : "warn",
      `Daily report: ${jobsFailed} failed jobs, ${affiliatesNeedingAction} affiliate actions pending`,
      summary,
      ctx.jobId
    );
  }

  return summary;
}
