import { db } from "@/lib/db";
import { slugify, hostname } from "@/lib/utils";
import { dedupProvider } from "./dedup";
import { fetchPage } from "./fetcher";
import { extractPage } from "./extract";
import type { JobContext } from "./runner";

/**
 * Agent A — Provider discovery.
 *
 * Inputs (payload):
 *   seeds: [{ name, websiteUrl, category? }]            — explicit candidates
 *   crawlFrom: [url]                                    — crawl official pages
 *                                                        for outbound links to
 *                                                        other provider domains
 *
 * Honest by design: it does NOT scrape search engines. Seed lists come from
 * `config/discovery-seeds.json`, curated directories you control, or links
 * found on already-known official sites.
 */

export interface DiscoverySeed {
  name: string;
  websiteUrl: string;
  category?: string;
}

export async function runDiscover(ctx: JobContext): Promise<{
  discovered: number;
  existing: number;
  ambiguous: number;
}> {
  const seeds = (ctx.payload.seeds ?? []) as DiscoverySeed[];
  const crawlFrom = (ctx.payload.crawlFrom ?? []) as string[];

  const candidates: DiscoverySeed[] = [...seeds];

  // Expand from already-known official pages: outbound links that look like
  // other providers get queued as candidates for later verification.
  for (const url of crawlFrom.slice(0, 20)) {
    const res = await fetchPage(url);
    if (res.error || res.status !== 200) {
      await ctx.log(`crawl source failed: ${url}`, { error: res.error });
      continue;
    }
    const page = extractPage(res.body, res.finalUrl);
    const ownHost = hostname(res.finalUrl);
    for (const link of page.links) {
      const h = hostname(link.href);
      if (!h || h === ownHost) continue;
      if (/(docs|support|help|status)\./.test(h)) continue;
      // Heuristic: external link text that looks like a company name
      if (link.text && link.text.length > 2 && link.text.length < 60) {
        candidates.push({ name: link.text, websiteUrl: `https://${h}` });
      }
    }
  }

  let discovered = 0;
  let existing = 0;
  let ambiguous = 0;

  for (const c of candidates) {
    const name = c.name.trim();
    const websiteUrl = c.websiteUrl.trim();
    if (!name || !websiteUrl.startsWith("http")) continue;

    const result = await dedupProvider(db, { name, websiteUrl });
    if (result.action === "existing") {
      existing++;
      continue;
    }
    if (result.action === "ambiguous") {
      ambiguous++;
      await db.reviewItem.create({
        data: {
          entity: "provider",
          entityId: result.existingId ?? "new",
          reason: `Possible duplicate: "${name}" (${websiteUrl}) — ${result.reason}`,
        },
      });
      continue;
    }

    const slug = await uniqueSlug(slugify(name));
    await db.provider.create({
      data: {
        slug,
        name,
        normalizedName: normalizeKey(name),
        websiteUrl,
        domain: hostname(websiteUrl),
        category: c.category ?? "other",
        status: "draft",
      },
    });
    discovered++;
    await ctx.log(`discovered provider: ${name}`, { slug });
  }

  return { discovered, existing, ambiguous };
}

function normalizeKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(
      /\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|pty|pte|sarl|sa|bv|ab|oy|plc)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || "provider";
  let i = 2;
  while (await db.provider.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}
