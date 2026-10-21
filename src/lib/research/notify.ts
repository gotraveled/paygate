import { db } from "@/lib/db";

/**
 * Failure/alert notifications. Always logs to JobLog; optionally POSTs to
 * NOTIFY_WEBHOOK_URL (Slack/Discord-compatible JSON).
 */
export async function notify(
  level: "info" | "warn" | "error",
  message: string,
  data?: unknown,
  jobId?: string
) {
  await db.jobLog
    .create({
      data: {
        jobId,
        level,
        message,
        data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)),
      },
    })
    .catch(() => {});

  const webhook = process.env.NOTIFY_WEBHOOK_URL;
  if (webhook && level !== "info") {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `[${level.toUpperCase()}] ${message}`,
        level,
        message,
        data,
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  }
}
