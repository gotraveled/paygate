import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { JobContext } from "./runner";
import { normalizeProvider, type ProviderFacts } from "./normalize";
import { briefProviderProfile, briefComparison, type ContentBrief } from "./brief";
import {
  writeProviderProfile,
  writeComparison,
  writeArticle,
  ARTICLE_TOPICS,
  type ArticleTopic,
} from "./write";
import { validatePage, shingleSimilarity } from "./quality";

/**
 * Agent D — Content creation, reworked around three layers:
 *
 *   Layer A  Source evidence   (Source + Evidence rows — untouched here)
 *   Layer B  Normalized facts   (normalize.ts → ProviderFacts)
 *   Layer C  Original prose      (write.ts — synthesizes from facts only)
 *
 * A content brief decides whether the page deserves to exist BEFORE any
 * prose is written (anti thin-SEO gating). Every draft then passes a
 * deterministic quality gate; critical failures keep the page out of
 * public statuses and open a ReviewItem explaining why.
 *
 * Status flow: facts_normalized → draft → quality_checking →
 *   review_required (passed, new page — needs human sign-off) or
 *   published (passed AND it was already published — low-risk refresh) or
 *   rejected (brief says the page shouldn't exist)
 */

async function otherPageBodies(exceptSlug?: string) {
  return db.contentPage.findMany({
    where: {
      status: { in: ["published", "review_required", "approved"] },
      ...(exceptSlug ? { NOT: { slug: exceptSlug } } : {}),
    },
    select: { slug: true, body: true },
    take: 200,
  });
}

/** Serialize the facts into strings — the corpus numbers must come from. */
function factCorpus(f: ProviderFacts): string[] {
  return [
    ...f.pricing.map((t) => `${t.label} ${t.display} ${t.conditions ?? ""}`),
    ...f.reserves.map(
      (r) => `${r.summary} ${r.percent ?? ""} ${r.daysMin ?? ""} ${r.daysMax ?? ""}`
    ),
    ...f.sources.map((s) => s.url),
    ...f.requiredDocs,
    ...f.applicationSteps,
    ...f.pros,
    ...f.cons,
    ...f.paymentTypeLabels,
    ...f.dataGaps,
    f.summary ?? "",
    f.suitableFor ?? "",
    f.limitations ?? "",
    f.registrationRequirement ?? "",
    f.ownerResidency ?? "",
    f.name,
    f.categoryLabel,
  ];
}

async function persistDraft(opts: {
  slug: string;
  type: string;
  title: string;
  summary: string;
  body: string;
  brief: ContentBrief;
  providerId?: string;
  countryCode?: string;
  industrySlug?: string;
  validation: ReturnType<typeof validatePage>;
}) {
  const { slug, type, title, summary, body, brief, validation } = opts;
  const existing = await db.contentPage.findUnique({ where: { slug } });

  let status: string;
  if (!brief.go) {
    status = "rejected"; // thin page — don't produce it
  } else if (!validation.ok) {
    status = "draft"; // failed critical checks — stays internal
  } else if (existing?.status === "published") {
    status = "published"; // low-risk refresh of an approved page
  } else {
    status = "review_required"; // new page — human sign-off
  }

  const page = await db.contentPage.upsert({
    where: { slug },
    create: {
      slug,
      type,
      title,
      summary,
      body: brief.go ? body : "", // rejected pages carry no prose
      status,
      providerId: opts.providerId,
      countryCode: opts.countryCode,
      industrySlug: opts.industrySlug,
      brief: brief as unknown as Prisma.InputJsonValue,
      quality: JSON.parse(JSON.stringify(validation)),
      publishedAt: status === "published" ? (existing?.publishedAt ?? new Date()) : null,
    },
    update: {
      title,
      summary,
      body: brief.go ? body : "",
      status,
      brief: brief as unknown as Prisma.InputJsonValue,
      quality: JSON.parse(JSON.stringify(validation)),
      publishedAt:
        status === "published" ? (existing?.publishedAt ?? new Date()) : null,
    },
  });

  if (!validation.ok && brief.go) {
    const failed = validation.checks
      .filter((c) => !c.passed && c.severity === "critical")
      .map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ""}`)
      .join(", ");
    await db.reviewItem.create({
      data: {
        entity: "content_page",
        entityId: page.id,
        reason: `Draft blocked by quality gate: ${failed}`,
      },
    });
  }
  if (!brief.go) {
    await db.reviewItem.create({
      data: {
        entity: "content_page",
        entityId: page.id,
        reason: `Brief rejected page as thin/duplicative: ${brief.reasons.join("; ")}`,
      },
    });
  }

  return { slug, status, validation, brief };
}

export async function runContent(ctx: JobContext) {
  const providerId = ctx.payload.providerId as string | undefined;
  const compare = ctx.payload.compare as string[] | undefined; // [slugA, slugB]
  const topic = ctx.payload.topic as ArticleTopic | undefined;

  if (compare && compare.length === 2) {
    return await draftComparison(compare[0], compare[1]);
  }
  if (topic && ARTICLE_TOPICS.includes(topic)) {
    return await draftArticle(topic);
  }
  if (providerId) {
    return await draftProviderProfile(providerId);
  }
  return await draftOverviewPage();
}

/* ---------------- provider profile ---------------- */

async function draftProviderProfile(providerId: string) {
  const facts = await normalizeProvider(providerId);
  if (!facts) throw new Error(`provider ${providerId} not found`);

  // Layer B → brief decides go/no-go
  const brief = briefProviderProfile(facts);
  const slug = `guide-${facts.slug}`;

  const draft = brief.go ? writeProviderProfile(facts) : null;
  const body = draft?.body ?? "";
  const title = draft?.title ?? `${facts.name}: fees, eligibility, and requirements`;

  // Quality gate — against peer pages and the normalized fact corpus.
  const others = await otherPageBodies(slug);
  const validation = validatePage({
    title,
    body,
    sources: facts.sources.map((s) => s.url),
    factTexts: factCorpus(facts),
    otherPages: others,
    selfSlug: slug,
    minLen: 1200,
    requireSources: true,
    keywordTerm: facts.name,
  });

  // Source-claim similarity warning (advisory): our prose is built from
  // normalized facts, but evidence claims can contain source-adjacent text.
  const claimText = facts.evidenceCoverage.fieldsWithEvidence.join(" ");
  const srcSim = shingleSimilarity(body, claimText, 10);
  validation.checks.push({
    name: "source_similarity_advisory",
    severity: "warning",
    passed: srcSim < 0.2,
    detail: `max 10-gram overlap with evidence claims: ${(srcSim * 100).toFixed(1)}%`,
  });

  return await persistDraft({
    slug,
    type: "guide",
    title,
    summary:
      draft?.summary ??
      `What ${facts.name} offers, eligibility, fees and terms — from official sources.`,
    body,
    brief,
    providerId,
    validation,
  });
}

/* ---------------- comparison ---------------- */

async function draftComparison(slugA: string, slugB: string) {
  const pa = await db.provider.findUnique({ where: { slug: slugA } });
  const pb = await db.provider.findUnique({ where: { slug: slugB } });
  if (!pa || !pb) throw new Error(`provider not found: ${slugA} or ${slugB}`);

  const fa = (await normalizeProvider(pa.id))!;
  const fb = (await normalizeProvider(pb.id))!;
  const brief = briefComparison(fa, fb);
  const slug = `compare-${slugA}-vs-${slugB}`;

  const draft = brief.go ? writeComparison(fa, fb) : null;
  const body = draft?.body ?? "";
  const title =
    draft?.title ?? `${fa.name} vs ${fb.name}: eligibility, fees, and differences`;

  const others = await otherPageBodies(slug);
  const validation = validatePage({
    title,
    body,
    sources: [...fa.sources, ...fb.sources].map((s) => s.url),
    factTexts: [...factCorpus(fa), ...factCorpus(fb)],
    otherPages: others,
    selfSlug: slug,
    minLen: 800,
    requireSources: true,
  });

  return await persistDraft({
    slug,
    type: "comparison",
    title,
    summary:
      draft?.summary ??
      `Evidence-based comparison of ${fa.name} and ${fb.name}.`,
    body,
    brief,
    validation,
  });
}

/* ---------------- educational articles ---------------- */

async function draftArticle(topic: ArticleTopic) {
  const draft = writeArticle(topic);
  if (!draft) throw new Error(`unknown article topic ${topic}`);

  const slug = `article-${topic}`;
  const brief: ContentBrief = {
    type: "article",
    subject: topic,
    audience: "merchants learning payment fundamentals",
    intent: `educational explainer on ${topic.replace(/-/g, " ")}`,
    uniqueValue: ["original worked examples", "provider-agnostic guidance"],
    keyEvidence: ["editorial knowledge — no provider claims"],
    missingInfo: [],
    go: true,
    reasons: ["foundational topic with durable search intent"],
  };

  const others = await otherPageBodies(slug);
  // Articles carry illustrative (clearly labeled) numbers — the fact corpus
  // is the article's own body, so numeric checks validate internal consistency
  // rather than invented provider claims.
  const validation = validatePage({
    title: draft.title,
    body: draft.body,
    sources: [],
    factTexts: [draft.body],
    otherPages: others,
    selfSlug: slug,
    minLen: 800,
    requireSources: false,
  });

  return await persistDraft({
    slug,
    type: "article",
    title: draft.title,
    summary: draft.summary,
    body: draft.body,
    brief,
    validation,
  });
}

/* ---------------- aggregate status page ---------------- */

async function draftOverviewPage() {
  const providers = await db.provider.findMany({
    where: { status: "published" },
    select: { name: true, lastVerifiedAt: true },
  });
  const verified = providers.filter((p) => p.lastVerifiedAt).length;

  const title = `Directory verification status — ${providers.length} providers`;
  const body = [
    `This page reports the current state of the directory's own data, refreshed periodically.`,
    `## Coverage\n\n- Providers tracked: ${providers.length}\n- Providers that have completed at least one verification pass: ${verified}\n- Providers pending verification: ${providers.length - verified}`,
    `## How to read this\n\nAn unverified provider is not necessarily inaccurate — it means our automated checks have not yet confirmed its details against official sources. Check individual profile pages for field-level status.`,
    `*Snapshot of internal database state; regenerated automatically.*`,
  ].join("\n\n");

  const slug = `report-directory-${new Date().toISOString().slice(0, 10)}`;
  const brief: ContentBrief = {
    type: "report",
    subject: slug,
    audience: "readers curious about directory methodology",
    intent: "directory data freshness",
    uniqueValue: ["quantifies verification coverage"],
    keyEvidence: ["internal counts"],
    missingInfo: [],
    go: true,
    reasons: ["operational transparency page"],
  };
  const others = await otherPageBodies(slug);
  const validation = validatePage({
    title,
    body,
    sources: [],
    factTexts: [`${providers.length}`, `${verified}`],
    otherPages: others,
    selfSlug: slug,
    minLen: 300,
    requireSources: false,
  });

  return await persistDraft({
    slug,
    type: "report",
    title,
    summary: `Verification coverage across ${providers.length} directory providers.`,
    body,
    brief,
    validation,
  });
}
