import { db } from "@/lib/db";
import { asStringArray } from "@/lib/utils";
import { CATEGORY_LABELS, SCOPE_LABELS } from "@/lib/constants";
import type { JobContext } from "./runner";

/**
 * Agent D — Content creation.
 *
 * Deterministic, template-driven drafts built ONLY from stored provider data
 * and evidence. No LLM paraphrasing = no invented facts. Every generated
 * page passes validation checks; failures route to review instead of publish.
 */

interface ValidationResult {
  ok: boolean;
  checks: { name: string; passed: boolean; detail?: string }[];
}

function validateDraft(page: {
  title: string;
  body: string;
  providerName?: string;
  bodyMinLen?: number;
}): ValidationResult {
  const checks = [
    {
      name: "length",
      passed: page.body.length >= (page.bodyMinLen ?? 400),
      detail: `${page.body.length} chars`,
    },
    {
      name: "no_unverified_superlatives",
      passed: !/\b(best|cheapest|#1|top-rated|guaranteed)\b/i.test(page.body),
      detail: "no marketing superlatives presented as fact",
    },
    {
      name: "no_placeholder",
      passed: !/(TODO|TBD|XXX|\[insert|lorem ipsum)/i.test(page.body),
      detail: "no placeholders",
    },
    {
      name: "title_present",
      passed: page.title.trim().length > 5,
    },
    {
      name: "discloses_uncertainty",
      passed: /unverified|not (publicly )?disclosed|conditional/i.test(
        page.body
      ),
      detail: "page acknowledges data limits",
    },
  ];
  return { ok: checks.every((c) => c.passed), checks };
}

export async function runContent(ctx: JobContext) {
  const providerId = ctx.payload.providerId as string | undefined;

  // Build content from verified data only
  if (providerId) {
    return await draftProviderGuide(providerId);
  }
  return await draftOverviewPage();
}

async function draftProviderGuide(providerId: string) {
  const p = await db.provider.findUnique({
    where: { id: providerId },
    include: {
      countries: { include: { country: true } },
      industries: { include: { industry: true } },
      pricing: true,
      reserves: true,
      evidence: {
        where: { status: { not: "outdated" } },
        include: { source: true },
        orderBy: { retrievedAt: "desc" },
        take: 20,
      },
    },
  });
  if (!p) throw new Error(`provider ${providerId} not found`);

  const applyCountries = p.countries.filter(
    (c) => c.scope === "merchant_apply" && c.status === "supported"
  );
  const prohibited = p.industries.filter((i) => i.status === "prohibited");

  const sections: string[] = [];
  sections.push(
    `${p.name} is a ${CATEGORY_LABELS[p.category] ?? p.category} ${p.hqCountryCode ? `headquartered in ${p.hqCountryCode} ` : ""}listed in our directory.${p.summary ? ` ${p.summary}` : ""}`
  );

  if (applyCountries.length > 0) {
    sections.push(
      `## Where merchants can apply\n\n${SCOPE_LABELS.merchant_apply}: ${applyCountries.map((c) => c.country.name).join(", ")}.`
    );
  } else {
    sections.push(
      `## Where merchants can apply\n\nApplication availability is not publicly disclosed or still unverified — check ${p.name}'s official documentation before applying.`
    );
  }

  if (p.pricing.length > 0) {
    const lines = p.pricing.map(
      (t) =>
        `- ${t.label}: ${t.amountMin != null ? `${t.amountMin}${t.unit === "percent" ? "%" : ` ${t.currency ?? ""}`}` : "not disclosed"}${t.conditions ? ` (${t.conditions})` : ""}`
    );
    sections.push(`## Published fees\n\n${lines.join("\n")}`);
  } else {
    sections.push(
      `## Published fees\n\nNo official pricing has been captured yet. Unverified — see the provider's pricing page.`
    );
  }

  if (prohibited.length > 0) {
    sections.push(
      `## Restricted industries\n\n${p.name} prohibits or restricts: ${prohibited.map((i) => i.industry.name).join(", ")}.`
    );
  }

  if (asStringArray(p.applicationSteps).length > 0) {
    sections.push(
      `## How to apply\n\n${asStringArray(p.applicationSteps).map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    );
  }

  const sourceUrls = p.evidence
    .map((e) => e.source?.url)
    .filter((u): u is string => !!u);
  if (sourceUrls.length > 0) {
    sections.push(
      `## Sources\n\n${[...new Set(sourceUrls)].map((u) => `- ${u}`).join("\n")}`
    );
  }

  sections.push(
    `\n*Some details are unverified or not publicly disclosed; confirm current terms on ${p.name}'s official website.*`
  );

  const title = `${p.name}: eligibility, fees, and application requirements`;
  const body = sections.join("\n\n");
  const validation = validateDraft({ title, body });

  const slug = `guide-${p.slug}`;
  const existing = await db.contentPage.findUnique({ where: { slug } });
  const status = validation.ok ? "review" : "draft";

  const page = await db.contentPage.upsert({
    where: { slug },
    create: {
      slug,
      type: "guide",
      title,
      summary: `How to apply for ${p.name}: eligibility, fees, reserves, and requirements from official sources.`,
      body,
      status,
      providerId: p.id,
      quality: JSON.parse(JSON.stringify(validation)),
    },
    update: {
      title,
      body,
      status: existing?.status === "published" ? "published" : status,
      quality: JSON.parse(JSON.stringify(validation)),
    },
  });

  if (!validation.ok) {
    await db.reviewItem.create({
      data: {
        entity: "content_page",
        entityId: page.id,
        reason: `Draft failed validation: ${validation.checks.filter((c) => !c.passed).map((c) => c.name).join(", ")}`,
      },
    });
  }

  return { slug, status, validation };
}

async function draftOverviewPage() {
  // Aggregate data-driven page — e.g. a summary of verified stats.
  const providers = await db.provider.findMany({
    where: { status: "published" },
    select: { name: true, category: true, lastVerifiedAt: true },
  });
  const verified = providers.filter((p) => p.lastVerifiedAt).length;

  const title = `Directory status: ${providers.length} providers tracked`;
  const body = [
    `This report covers ${providers.length} providers in the directory.`,
    `## Verification coverage\n\n- Providers with a completed verification pass: ${verified}`,
    `- Providers still unverified: ${providers.length - verified}`,
    `\n*Numbers reflect the database at generation time and are unverified snapshots.*`,
  ].join("\n\n");

  const slug = `report-directory-${new Date().toISOString().slice(0, 10)}`;
  const validation = validateDraft({ title, body, bodyMinLen: 200 });
  const page = await db.contentPage.upsert({
    where: { slug },
    create: {
      slug,
      type: "report",
      title,
      body,
      status: validation.ok ? "review" : "draft",
      quality: JSON.parse(JSON.stringify(validation)),
    },
    update: {
      body,
      quality: JSON.parse(JSON.stringify(validation)),
    },
  });
  return { slug, status: page.status, validation };
}
