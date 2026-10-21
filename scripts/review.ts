/**
 * Minimal content review CLI — the review-first workflow's human gate.
 *
 * Usage:
 *   npx tsx scripts/review.ts list [status]           — pending pages
 *   npx tsx scripts/review.ts approve <slug> [note]   — publish a page
 *   npx tsx scripts/review.ts reject <slug> [note]    — reject a page
 *   npx tsx scripts/review.ts reopen <slug>           — back to review_required
 *
 * Approve = reviewer confirms the page is accurate against its sources.
 * The script records reviewedAt + reviewNote; only "published" is public.
 */
import { db } from "@/lib/db";

const [cmd, slug, ...noteParts] = process.argv.slice(2);
const note = noteParts.join(" ") || undefined;

async function main() {
  if (cmd === "list") {
    const status = slug ?? "review_required";
    const pages = await db.contentPage.findMany({
      where: { status },
      select: {
        slug: true,
        type: true,
        title: true,
        updatedAt: true,
        quality: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (pages.length === 0) {
      console.log(`No pages with status "${status}".`);
      return;
    }
    for (const p of pages) {
      const q = (p.quality as { checks?: { passed: boolean }[] } | null)?.checks;
      const failed = q?.filter((c) => !c.passed).length ?? "?";
      console.log(
        `${p.slug.padEnd(34)} ${p.type.padEnd(11)} fails:${String(failed).padEnd(3)} ${p.title.slice(0, 60)}`
      );
    }
    console.log(`\n${pages.length} page(s) with status "${status}".`);
    return;
  }

  if (!slug) {
    console.error(`usage: review.ts ${cmd} <slug> [note]`);
    process.exit(1);
  }
  const page = await db.contentPage.findUnique({ where: { slug } });
  if (!page) throw new Error(`page ${slug} not found`);

  if (cmd === "approve") {
    await db.contentPage.update({
      where: { slug },
      data: {
        status: "published",
        publishedAt: page.publishedAt ?? new Date(),
        reviewedAt: new Date(),
        reviewNote: note ?? "approved by reviewer",
      },
    });
    console.log(`${slug} -> published`);
    return;
  }

  if (cmd === "reject") {
    await db.contentPage.update({
      where: { slug },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
        reviewNote: note ?? "rejected by reviewer",
      },
    });
    console.log(`${slug} -> rejected`);
    return;
  }

  if (cmd === "reopen") {
    await db.contentPage.update({
      where: { slug },
      data: {
        status: "review_required",
        reviewNote: note ?? "returned to review queue",
      },
    });
    console.log(`${slug} -> review_required`);
    return;
  }

  console.error("commands: list | approve | reject | reopen");
  process.exit(1);
}

main()
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  })
  .finally(() => process.exit(0));
