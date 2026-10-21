/** Run the content pipeline for a provider and print the generated draft.
 *  Usage: npx tsx scripts/inspect-content.ts <slug>
 *         npx tsx scripts/inspect-content.ts "stripe vs paypal"
 */
import "dotenv/config";

async function main() {
  const slug = process.argv[2] ?? "stripe";
  const { db } = await import("@/lib/db");
  const { runContent } = await import("@/lib/research/content");

  const ctx = {
    jobId: "inspect",
    payload: {} as Record<string, unknown>,
    log: async () => {},
  };

  if (slug.includes(" vs ")) {
    const [a, b] = slug.split(" vs ").map((s) => s.trim());
    ctx.payload.compare = [a, b];
  } else {
    const p = await db.provider.findUnique({ where: { slug } });
    if (!p) throw new Error(`provider ${slug} not found`);
    ctx.payload.providerId = p.id;
  }
  const result = await runContent(ctx);

  const res = result as {
    slug?: string;
    status?: string;
    brief?: { go: boolean; reasons: string[]; uniqueValue: string[]; missingInfo: string[] };
    validation?: { ok: boolean; checks: { name: string; severity: string; passed: boolean; detail?: string }[] };
  };
  console.log("=== RESULT ===");
  console.log(JSON.stringify({ slug: res.slug, status: res.status }, null, 2));
  console.log("=== BRIEF ===");
  console.log(JSON.stringify(res.brief, null, 2));
  console.log("=== QUALITY CHECKS ===");
  for (const c of res.validation?.checks ?? []) {
    console.log(
      `  [${c.passed ? "PASS" : "FAIL"}] ${c.severity.padEnd(8)} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`
    );
  }

  if (res.slug) {
    const page = await db.contentPage.findUnique({ where: { slug: res.slug } });
    console.log(`=== BODY (${page?.status}) ===`);
    console.log(page?.body ?? "(none)");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
