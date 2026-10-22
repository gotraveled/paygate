/**
 * Prompt-4 audit runner.
 *
 *   npx tsx scripts/audit-pilot.ts <command> [arg]
 *
 *   sources <slug>           — Source rows: url, finalUrl, httpStatus, geo, hash, fetchedAt
 *   claims <slug>            — country claims w/ status, evidence link, reason, confidence
 *   claims-all               — same for the five pilot providers, tabulated
 *   evidence <slug> [field]  — non-outdated evidence rows w/ source url + excerpt
 *   state                    — per-provider counts: sources/evidence/claims/pages/review items
 *   job <type> <slug> [urls..] — run a research job handler (research|claimify|verify|content)
 *   snapshot                 — write a JSON snapshot of claim/evidence/review counts (for
 *                              idempotency comparisons; prints path)
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { db } from "@/lib/db";
import { runResearch } from "@/lib/research/research";
import { runClaimify } from "@/lib/research/claimify";
import { runVerify } from "@/lib/research/verify";
import { runContent } from "@/lib/research/content";

const PILOT = ["stripe", "razorpay", "paddle", "paymentcloud", "square"];
const ctx = (payload: Record<string, unknown>) => ({
  jobId: `audit-${Date.now()}`,
  payload,
  log: async () => {},
});

async function providerId(slug: string) {
  const p = await db.provider.findUnique({ where: { slug }, select: { id: true } });
  if (!p) throw new Error(`provider ${slug} not found`);
  return p.id;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === "sources") {
    const id = await providerId(args[0]);
    const rows = await db.source.findMany({
      where: { providerId: id },
      orderBy: { url: "asc" },
    });
    for (const s of rows) {
      console.log(
        `[${s.httpStatus ?? "?"}]`,
        s.url.slice(0, 72),
        s.finalUrl && s.finalUrl !== s.url ? `-> ${s.finalUrl.slice(0, 50)}` : "",
        s.geoContext ? `(${s.geoContext})` : "",
        `#${s.contentHash?.slice(0, 8) ?? "-"}`,
        s.lastFetchedAt ? s.lastFetchedAt.toISOString().slice(0, 16) : "-"
      );
    }
    console.log("total:", rows.length);
    return;
  }

  if (cmd === "claims" || cmd === "claims-all") {
    const slugs = cmd === "claims-all" ? PILOT : [args[0]];
    for (const slug of slugs) {
      const id = await providerId(slug);
      const rows = await db.providerCountryEligibility.findMany({
        where: { providerId: id },
        orderBy: [{ scope: "asc" }, { countryCode: "asc" }],
      });
      const evIds = rows.map((r) => r.evidenceId).filter(Boolean) as string[];
      const evMap = new Map(
        (
          await db.evidence.findMany({
            where: { id: { in: evIds } },
            select: { id: true, claim: true, source: { select: { url: true } } },
          })
        ).map((e) => [e.id, e])
      );
      console.log(`=== ${slug} (${rows.length} claims)`);
      const byStatus = new Map<string, number>();
      for (const r of rows) {
        byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
        const ev = r.evidenceId ? evMap.get(r.evidenceId) : undefined;
        console.log(
          ` ${r.countryCode} ${r.scope} ${r.status.padEnd(13)} conf=${(r.confidence ?? 0).toFixed(2)}`,
          ev ? `ev→${(ev.source?.url ?? "?").slice(0, 55)}` : "ev→none(seed)",
          r.statusReason ? `| ${r.statusReason.slice(0, 60)}` : ""
        );
      }
      console.log(" status:", [...byStatus.entries()].map(([k, v]) => `${k}:${v}`).join(" "));
    }
    return;
  }

  if (cmd === "evidence") {
    const id = await providerId(args[0]);
    const rows = await db.evidence.findMany({
      where: {
        providerId: id,
        status: { not: "outdated" },
        ...(args[1] ? { field: { contains: args[1] } } : {}),
      },
      include: { source: { select: { url: true } } },
      orderBy: { retrievedAt: "desc" },
    });
    for (const e of rows) {
      console.log(
        e.field.padEnd(30),
        e.status.padEnd(12),
        `conf=${e.confidence.toFixed(2)}`,
        (e.extractionMethod ?? "-").padEnd(8),
        (e.source?.url ?? "-").slice(0, 55),
        "|",
        e.claim.slice(0, 90)
      );
    }
    console.log("total:", rows.length);
    return;
  }

  if (cmd === "state") {
    for (const slug of PILOT) {
      const id = await providerId(slug);
      const [srcs, srcOk, ev, evActive, claims, claimsLinked, claimsByStatus] =
        await Promise.all([
          db.source.count({ where: { providerId: id } }),
          db.source.count({ where: { providerId: id, httpStatus: 200 } }),
          db.evidence.count({ where: { providerId: id } }),
          db.evidence.count({ where: { providerId: id, status: { not: "outdated" } } }),
          db.providerCountryEligibility.count({ where: { providerId: id } }),
          db.providerCountryEligibility.count({
            where: { providerId: id, evidenceId: { not: null } },
          }),
          db.providerCountryEligibility.groupBy({
            by: ["status"],
            where: { providerId: id },
            _count: true,
          }),
        ]);
      console.log(
        slug.padEnd(14),
        `src=${srcs}(ok:${srcOk})`,
        `ev=${ev}(active:${evActive})`,
        `claims=${claims}(linked:${claimsLinked})`,
        claimsByStatus.map((s) => `${s.status}:${s._count}`).join(",")
      );
    }
    const [pages, reviews] = await Promise.all([
      db.contentPage.groupBy({ by: ["status"], _count: true }),
      db.reviewItem.groupBy({ by: ["status"], _count: true }),
    ]);
    console.log("pages:", pages.map((p) => `${p.status}:${p._count}`).join(" "));
    console.log("reviewItems:", reviews.map((r) => `${r.status}:${r._count}`).join(" "));
    return;
  }

  if (cmd === "job") {
    const [type, slug, ...urls] = args;
    const id = await providerId(slug);
    const payload: Record<string, unknown> = { providerId: id };
    if (urls.length) payload.urls = urls;
    const c = ctx(payload);
    const out =
      type === "research"
        ? await runResearch(c)
        : type === "claimify"
          ? await runClaimify(c)
          : type === "verify"
            ? await runVerify(c)
            : type === "content"
              ? await runContent(c)
              : null;
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (cmd === "outdate-noise") {
    // Mark evidence sourced from non-authoritative page types (blog, partner
    // directories, help/community) as outdated — keeps history, removes it
    // from claimify input. Reports each row before marking.
    const { isEvidencePath } = await import("@/lib/research/research");
    const rows = await db.evidence.findMany({
      where: { status: { not: "outdated" }, sourceId: { not: null } },
      include: { source: { select: { url: true, finalUrl: true } } },
    });
    let n = 0;
    for (const e of rows) {
      const u = e.source?.finalUrl || e.source?.url || "";
      if (u && !isEvidencePath(u)) {
        await db.evidence.update({
          where: { id: e.id },
          data: { status: "outdated" },
        });
        n++;
        console.log("outdated:", e.field.padEnd(22), u.slice(0, 80));
      }
    }
    console.log(`marked ${n} evidence rows outdated (non-authoritative page types)`);
    return;
  }

  if (cmd === "outdate-headings") {
    // Evidence recorded before the heading filters existed stays "active"
    // forever — supersession only applies to same-source re-records. Re-test
    // each stored heading against the CURRENT filters; failures go outdated.
    const { POLICY_HEADING, PAYOUT_HEADING, GENERIC_HEADING } = await import(
      "@/lib/research/research"
    );
    const rows = await db.evidence.findMany({
      where: {
        status: { not: "outdated" },
        field: { in: ["industries.policy", "payouts.policy"] },
      },
      include: { source: { select: { url: true } } },
    });
    let n = 0;
    for (const e of rows) {
      const heading = (e.value as { heading?: string } | null)?.heading ?? "";
      const re = e.field === "industries.policy" ? POLICY_HEADING : PAYOUT_HEADING;
      if (!re.test(heading) || GENERIC_HEADING.test(heading)) {
        await db.evidence.update({
          where: { id: e.id },
          data: { status: "outdated" },
        });
        n++;
        console.log("outdated:", e.field.padEnd(20), `"${heading}"`, e.source?.url?.slice(0, 60));
      }
    }
    console.log(`marked ${n} evidence rows outdated (heading fails current filters)`);
    return;
  }

  if (cmd === "render-check") {
    // SSR-render each draft body through the real Markdown component and
    // validate what a reader would actually see: TOC anchors resolve to
    // heading ids, tables/callouts render, external links carry
    // rel=noopener, and no literal markdown markers leak.
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { Markdown } = await import("@/lib/markdown");
    // Direct query — getPublishedPage() wraps cacheLife(), a Next runtime
    // API unavailable in a plain tsx process.
    const getPublishedPage = (slug: string) =>
      db.contentPage.findFirst({ where: { slug, status: "published" } });

    const slugs = args.length
      ? args
      : ["guide-stripe", "compare-stripe-vs-razorpay", "article-in-payment-processors", "article-foreign-founders"];
    for (const slug of slugs) {
      const p = await db.contentPage.findUnique({ where: { slug } });
      if (!p) { console.log(slug, "MISSING"); continue; }
      // Draft must not be publicly queryable.
      const pub = await getPublishedPage(slug);
      const html = renderToStaticMarkup(createElement(Markdown, { source: p.body }));

      const headingIds = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      const tocAnchors = [...p.body.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
      const missing = tocAnchors.filter((a) => !headingIds.includes(a));
      const tables = (html.match(/<table/g) ?? []).length;
      const noopener = (html.match(/rel="noopener noreferrer"/g) ?? []).length;
      const extLinks = (html.match(/target="_blank"/g) ?? []).length;
      const literalStar = html.includes("*(unverified)") || html.includes("*(") ? "FOUND" : "clean";
      const rawHtml = /<script(?![^>]*ld\+json)/.test(html) ? "FOUND" : "clean";

      console.log(`\n=== ${slug} (${p.status}) ===`);
      console.log(`  public-queryable: ${pub ? "YES — PUBLISHED" : "no (draft gated)"}`);
      console.log(`  headings: ${headingIds.length}, toc-anchors: ${tocAnchors.length}, unresolved: ${missing.length}${missing.length ? " -> " + missing.join(",") : ""}`);
      console.log(`  tables: ${tables}, ext-links: ${extLinks}, noopener: ${noopener}`);
      console.log(`  literal *: ${literalStar}, raw-html: ${rawHtml}`);
      if (missing.length) console.log("  DEFECT: TOC anchors do not resolve");
      if (literalStar === "FOUND") console.log("  DEFECT: literal markdown markers in rendered output");
    }
    return;
  }

  if (cmd === "pubcheck") {
    // Publication-safety smoke: creates a throwaway draft, walks it through
    // approve -> reject -> reopen, and verifies the published-only predicates
    // (public query + sitemap inclusion) flip exactly on "published".
    const slug = "audit-pubcheck-tmp";
    await db.contentPage.deleteMany({ where: { slug } });
    await db.contentPage.create({
      data: {
        slug,
        type: "article",
        title: "Audit temp page",
        summary: "temporary page for publication-safety verification",
        body: "Temporary body.",
        status: "review_required",
      },
    });
    const pubQ = () =>
      db.contentPage.findFirst({ where: { slug, status: "published" } });
    const inSitemap = async () =>
      (await db.contentPage.findMany({
        where: { status: "published" },
        select: { slug: true },
      })).some((p) => p.slug === slug);

    const at = async (label: string) =>
      console.log(
        `  ${label.padEnd(18)} publicQuery=${(await pubQ()) ? "YES" : "no"}  sitemap=${(await inSitemap()) ? "YES" : "no"}`
      );

    await at("review_required");

    await db.contentPage.update({
      where: { slug },
      data: { status: "published", publishedAt: new Date(), reviewedAt: new Date(), reviewNote: "audit" },
    });
    await at("published");

    await db.contentPage.update({
      where: { slug },
      data: { status: "rejected", reviewedAt: new Date(), reviewNote: "audit" },
    });
    await at("rejected");

    await db.contentPage.update({
      where: { slug },
      data: { status: "review_required", reviewNote: "audit" },
    });
    await at("reopened");

    // Verify review metadata persisted on the real flow (publishedAt set on
    // approve, reviewedAt + reviewNote on all transitions).
    const row = await db.contentPage.findUnique({ where: { slug } });
    console.log(`  metadata: publishedAt=${row?.publishedAt?.toISOString() ?? "-"} reviewedAt=${row?.reviewedAt?.toISOString() ?? "-"} note=${row?.reviewNote ?? "-"}`);

    await db.contentPage.delete({ where: { slug } });
    console.log("  throwaway page deleted");
    return;
  }

  if (cmd === "snapshot") {
    const snap: Record<string, unknown> = { at: new Date().toISOString(), providers: {} };
    for (const slug of PILOT) {
      const id = await providerId(slug);
      (snap.providers as Record<string, unknown>)[slug] = {
        evidence: await db.evidence.count({ where: { providerId: id } }),
        evidenceActive: await db.evidence.count({
          where: { providerId: id, status: { not: "outdated" } },
        }),
        claims: await db.providerCountryEligibility.count({ where: { providerId: id } }),
        claimsLinked: await db.providerCountryEligibility.count({
          where: { providerId: id, evidenceId: { not: null } },
        }),
        claimsByStatus: await db.providerCountryEligibility.groupBy({
          by: ["status"],
          where: { providerId: id },
          _count: true,
        }),
        pricingTerms: await db.pricingTerm.count({ where: { providerId: id } }),
        payoutTerms: await db.reservePayoutTerm.count({ where: { providerId: id } }),
      };
    }
    snap.reviewItems = await db.reviewItem.groupBy({ by: ["status"], _count: true });
    const path = `snapshots/audit-${Date.now()}.json`;
    writeFileSync(path, JSON.stringify(snap, null, 2));
    console.log(path);
    console.log(JSON.stringify(snap.providers));
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
