/**
 * Audit helper: record manual evidence for claims verified against pages
 * actually retrieved during the Prompt-3 audit, and fix confirmed-wrong
 * normalized claim rows with a linked evidence trail.
 *
 * Usage: npx tsx scripts/audit-evidence.ts <command> [args]
 *   countries <providerSlug>   — list providerCountryEligibility rows
 *   evidence <providerSlug>    — list non-outdated evidence rows
 *   verify-country <providerSlug> <code> <scope> <status> <sourceUrl> <excerpt>
 *                              — record manual evidence + update claim row
 *   add-evidence <providerSlug> <field> <status> <sourceUrl> <claim> <excerpt>
 */
import { db } from "@/lib/db";
import { recordEvidence } from "@/lib/research/evidence";

const [cmd, ...args] = process.argv.slice(2);

async function main() {
  if (cmd === "countries") {
    const [slug] = args;
    const p = await db.provider.findUnique({ where: { slug } });
    if (!p) throw new Error(`provider ${slug} not found`);
    const rows = await db.providerCountryEligibility.findMany({
      where: { providerId: p.id },
    });
    for (const r of rows)
      console.log(r.countryCode, r.scope, r.status, "ev:" + (r.evidenceId ?? "-"));
    return;
  }

  if (cmd === "evidence") {
    const [slug, field] = args;
    const rows = await db.evidence.findMany({
      where: {
        provider: { slug },
        status: { not: "outdated" },
        ...(field ? { field: { contains: field } } : {}),
      },
      include: { source: { select: { url: true } } },
      orderBy: { retrievedAt: "desc" },
    });
    for (const r of rows)
      console.log(
        r.field.padEnd(26),
        r.status.padEnd(13),
        r.source?.url ?? "-",
        "|",
        String(r.claim).slice(0, 100)
      );
    console.log("count:", rows.length);
    return;
  }

  if (cmd === "verify-country") {
    const [slug, code, scope, status, sourceUrl, ...excerptParts] = args;
    const excerpt = excerptParts.join(" ");
    const p = await db.provider.findUnique({ where: { slug } });
    if (!p) throw new Error(`provider ${slug} not found`);
    const source = await db.source.findFirst({ where: { url: sourceUrl } });
    if (!source) throw new Error(`source ${sourceUrl} not registered`);

    const ev = await recordEvidence({
      providerId: p.id,
      field: `countries.${scope}.${code}`,
      claim: `Merchant application eligibility for ${code}: ${status} (manually verified against retrieved page)`,
      value: { code, scope, status, excerpt: excerpt.slice(0, 600) },
      status: "supported",
      method: "manual",
      confidence: 0.9,
      sourceId: source.id,
    });

    const row = await db.providerCountryEligibility.findFirst({
      where: { providerId: p.id, countryCode: code, scope },
    });
    if (row) {
      await db.providerCountryEligibility.update({
        where: { id: row.id },
        data: {
          status,
          evidenceId: ev.id,
          verifiedBy: "local-audit",
          verifiedAt: new Date(),
          statusReason: `manually verified against ${sourceUrl}`,
          confidence: 0.9,
        },
      });
      console.log("updated claim row:", code, scope, "->", status);
    } else {
      console.log("no claim row for", code, scope, "— evidence only");
    }
    console.log("evidence:", ev.id);
    return;
  }

  if (cmd === "add-evidence") {
    const [slug, field, status, sourceUrl, claim, ...excerptParts] = args;
    const excerpt = excerptParts.join(" ");
    const p = await db.provider.findUnique({ where: { slug } });
    if (!p) throw new Error(`provider ${slug} not found`);
    const source = await db.source.findFirst({ where: { url: sourceUrl } });
    const ev = await recordEvidence({
      providerId: p.id,
      field,
      claim,
      value: { excerpt: excerpt.slice(0, 600) },
      status,
      method: "manual",
      confidence: 0.85,
      sourceId: source?.id,
    });
    console.log("evidence:", ev.id);
    return;
  }

  console.error("unknown command:", cmd);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  })
  .finally(() => process.exit(0));
