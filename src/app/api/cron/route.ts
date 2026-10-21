import { NextResponse } from "next/server";
import {
  dailyPipeline,
  scheduleResearch,
  scheduleVerification,
  scheduleContent,
  runJob,
  drain,
} from "@/lib/research";
import type { JobType } from "@/lib/constants";
import { JOB_TYPES } from "@/lib/constants";

/**
 * Cron entry point. Secured by Authorization: Bearer <CRON_SECRET>.
 *
 * GET /api/cron            -> full daily pipeline
 * GET /api/cron?job=verify -> a single job type
 * GET /api/cron?mode=drain -> process the pending queue
 *
 * On Vercel, schedule via vercel.json crons hitting this endpoint.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const job = searchParams.get("job");
  const mode = searchParams.get("mode");

  try {
    if (mode === "drain") {
      const results = await drain(undefined, 25);
      return NextResponse.json({ ok: true, drained: results.length, results });
    }
    if (job && (JOB_TYPES as readonly string[]).includes(job)) {
      const payload: Record<string, unknown> = {};
      if (searchParams.get("providerId"))
        payload.providerId = searchParams.get("providerId");
      const result = await runJob(job as JobType, payload);
      return NextResponse.json(result);
    }
    if (job === "research-all") {
      return NextResponse.json({ ok: true, results: await scheduleResearch() });
    }
    if (job === "verify-all") {
      return NextResponse.json({
        ok: true,
        results: await scheduleVerification(),
      });
    }
    if (job === "content-all") {
      return NextResponse.json({ ok: true, results: await scheduleContent() });
    }

    const result = await dailyPipeline();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
