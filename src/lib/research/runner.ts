import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { notify } from "./notify";
import type { JobType } from "@/lib/constants";

/**
 * Minimal durable job runner.
 *
 * - Jobs are rows in ResearchJob with status/attempts — safe to retry.
 * - `enqueue` dedupes: an identical pending job is not created twice.
 * - `runNext` claims one pending job atomically-ish (status flip) and executes
 *   the registered handler. Failures increment attempts and requeue until
 *   maxAttempts, then fail permanently with a notification.
 */

export interface JobContext {
  jobId: string;
  payload: Record<string, unknown>;
  log: (message: string, data?: unknown) => Promise<void>;
}

type Handler = (ctx: JobContext) => Promise<void>;

const handlers = new Map<JobType, Handler>();

export function registerHandler(type: JobType, handler: Handler) {
  handlers.set(type, handler);
}

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown> = {}
) {
  const existing = await db.researchJob.findFirst({
    where: {
      type,
      status: "pending",
      payload: { equals: payload as Prisma.InputJsonValue },
    },
  });
  if (existing) return { job: existing, created: false };
  const job = await db.researchJob.create({
    data: { type, payload: JSON.parse(JSON.stringify(payload)) },
  });
  return { job, created: true };
}

export async function runJob(
  type: JobType,
  payload: Record<string, unknown> = {}
): Promise<{ ok: boolean; error?: string }> {
  const { job } = await enqueue(type, payload);
  return execute(job.id);
}

export async function execute(jobId: string) {
  const job = await db.researchJob.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, error: "job not found" };
  const handler = handlers.get(job.type as JobType);
  if (!handler) return { ok: false, error: `no handler for ${job.type}` };

  await db.researchJob.update({
    where: { id: job.id },
    data: {
      status: "running",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  const log = async (message: string, data?: unknown) => {
    await db.jobLog
      .create({
        data: {
          jobId: job.id,
          level: "info",
          message,
          data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)),
        },
      })
      .catch(() => {});
  };

  try {
    await handler({
      jobId: job.id,
      payload: (job.payload ?? {}) as Record<string, unknown>,
      log,
    });
    await db.researchJob.update({
      where: { id: job.id },
      data: { status: "success", finishedAt: new Date(), error: null },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = job.attempts + 1 >= job.maxAttempts;
    await db.researchJob.update({
      where: { id: job.id },
      data: {
        status: failed ? "failed" : "pending",
        finishedAt: new Date(),
        error: message,
      },
    });
    await notify(
      failed ? "error" : "warn",
      `Job ${job.type} ${failed ? "failed permanently" : "will retry"}: ${message}`,
      { jobId: job.id, attempts: job.attempts + 1 },
      job.id
    );
    return { ok: false, error: message };
  }
}

/** Run all pending jobs of the given types (or all types). */
export async function drain(types?: JobType[], limit = 50) {
  const pending = await db.researchJob.findMany({
    where: {
      status: "pending",
      ...(types ? { type: { in: types } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const results: { jobId: string; ok: boolean; error?: string }[] = [];
  for (const job of pending) {
    results.push({ jobId: job.id, ...(await execute(job.id)) });
  }
  return results;
}
