/**
 * CLI job runner.
 *
 *   npx tsx scripts/run-job.ts <type> [jsonPayload]
 *   npx tsx scripts/run-job.ts drain
 *   npx tsx scripts/run-job.ts daily
 *
 * Examples:
 *   npx tsx scripts/run-job.ts discover '{"seeds":[{"name":"Mollie","websiteUrl":"https://www.mollie.com","category":"payment_gateway"}]}'
 *   npx tsx scripts/run-job.ts research '{"providerId":"..."}'
 */
import "dotenv/config";

async function main() {
  const [, , type, rawPayload] = process.argv;
  if (!type) {
    console.error(
      "usage: tsx scripts/run-job.ts <discover|research|verify|content|affiliates|report|drain|daily> [payload-json]"
    );
    process.exit(1);
  }

  const { runJob, drain, dailyPipeline } = await import("@/lib/research");
  const payload = rawPayload ? JSON.parse(rawPayload) : {};

  if (type === "drain") {
    const results = await drain(undefined, 25);
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  if (type === "daily") {
    console.log(JSON.stringify(await dailyPipeline(), null, 2));
    return;
  }

  const result = await runJob(type as never, payload);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
