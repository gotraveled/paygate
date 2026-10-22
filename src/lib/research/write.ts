import { stableHash } from "@/lib/utils";
import type { ProviderFacts } from "./normalize";

/**
 * Layer C — Editorial writer.
 *
 * Generates original prose from normalized facts (Layer B). It never reads
 * or reuses source-page text — only structured claims — so output cannot
 * paraphrase a provider's own website. Sentence structure varies with the
 * underlying data (a payfac profile reads differently from a high-risk
 * specialist's), and deterministic variant selection keyed on the provider
 * ID keeps repeated boilerplate from appearing verbatim across pages.
 *
 * Design rules baked in here:
 * - Every numeric claim traces to a stored PricingTerm/ReservePayoutTerm.
 * - Missing data is described AS missing — never filled by guessing.
 * - No superlatives, no fake reviews, no approval-likelihood claims.
 * - Affiliate status only mentioned when a program is approved.
 */

export interface DraftOutput {
  title: string;
  summary: string;
  body: string;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Pick a variant deterministically per provider+section so profiles differ. */
function variant(seed: string, options: string[]): string {
  return options[parseInt(stableHash(seed), 16) % options.length];
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

// `how` is a verb phrase usable after the provider name ("Stripe …"); it
// never repeats the category label so variants can compose without doubling.
const MODEL_EXPLAINERS: Record<string, { how: string; implication: string }> = {
  payfac: {
    how: "underwrites a shared merchant pool, letting most standard businesses start processing quickly without a dedicated acquiring relationship",
    implication:
      "the same pooled structure means risk controls are largely automated, and accounts flagged by those controls can face holds with limited recourse",
  },
  mor: {
    how: "sells as the Merchant of Record — it becomes the legal seller of each transaction and absorbs sales-tax/VAT registration, collection, and remittance on the merchant's behalf",
    implication:
      "the convenience trades directly for a higher effective take rate than raw card processing, and the provider must approve each product catalog",
  },
  high_risk: {
    how: "places hard-to-approve businesses with partner acquiring banks that underwrite riskier categories",
    implication:
      "pricing, reserves, and contract terms are set per-merchant by the acquiring partner, so published figures are usually unavailable before underwriting",
  },
  merchant_account: {
    how: "provides a dedicated merchant account through direct acquiring relationships",
    implication:
      "merchants get more negotiating room and stability than pooled models, at the cost of heavier underwriting before approval",
  },
  payment_gateway: {
    how: "supplies the gateway layer that connects a merchant's checkout to acquiring and payment networks",
    implication:
      "the gateway itself may pair with a separate merchant account — total cost needs both sides priced in",
  },
  payment_processor: {
    how: "bundles card acceptance into a single processing relationship with flat published pricing",
    implication:
      "simplicity favors smaller merchants; high-volume or complex businesses may outgrow flat-rate economics",
  },
  formation: {
    how: "files business entity paperwork and related compliance documents on a founder's behalf",
    implication:
      "formation is a one-time service, but registered-agent and compliance renewals create recurring obligations to budget for",
  },
};

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function sectionOverview(f: ProviderFacts): string {
  const model = MODEL_EXPLAINERS[f.category];
  const hq = f.hq ? ` headquartered in ${f.hq}` : "";
  const opener = model
    ? variant(`${f.id}:overview`, [
        `${f.name} is a ${f.categoryLabel.toLowerCase()}${hq}. It ${model.how}.`,
        `As a ${f.categoryLabel.toLowerCase()}${hq}, ${f.name} ${model.how}.`,
        `${f.name} operates as a ${f.categoryLabel.toLowerCase()}${hq} — it ${model.how}.`,
        `What ${f.name} offers is a ${f.categoryLabel.toLowerCase()} model${hq}: it ${model.how}.`,
      ])
    : `${f.name} is a ${f.categoryLabel.toLowerCase()}${hq}.`;
  const parts = [opener];
  if (f.summary && !model) parts.push(f.summary);
  if (f.suitableFor) {
    const suit =
      f.suitableFor.charAt(0).toLowerCase() + f.suitableFor.slice(1).replace(/\.$/, "");
    parts.push(
      variant(`${f.id}:suit`, [
        `Its offering is aimed at ${suit}.`,
        `The provider positions itself for ${suit}.`,
        `Businesses most likely to consider it: ${suit}.`,
      ])
    );
  }
  if (model)
    parts.push(
      `In practical terms, ${model.implication} — a trade-off worth weighing before applying.`
    );
  return parts.join("\n\n");
}

function sectionEligibility(f: ProviderFacts): string {
  const lines: string[] = [];
  const m = f.merchantApply;
  const total = m.supported.length + m.conditional.length + m.notSupported.length + m.unverified.length;

  if (total === 0) {
    lines.push(
      `${f.name} does not publish — or we have not yet verified — a list of countries whose businesses can open an account. Treat eligibility as unknown and confirm directly before building plans around it.`
    );
  } else {
    if (m.supported.length > 0)
      lines.push(
        `${f.name} accepts merchant applications from businesses registered in ${joinNames(m.supported.map((c) => c.name))}.`
      );
    if (m.conditional.length > 0)
      lines.push(
        `Applications from ${joinNames(m.conditional.map((c) => c.name))} are conditionally available — approval may depend on entity type, product, or an invitation rather than open signup.`
      );
    if (m.notSupported.length > 0)
      lines.push(
        `Businesses registered in ${joinNames(m.notSupported.map((c) => c.name))} cannot apply directly. Where this applies to you, a foreign entity or a Merchant of Record provider may be a route worth exploring instead.`
      );
    if (m.unverified.length > 0)
      lines.push(
        `For ${joinNames(m.unverified.map((c) => c.name))}, application availability is not verified — the provider's documentation does not confirm it either way.`
      );
  }

  if (f.registrationRequirement)
    lines.push(`Entity requirements: ${f.registrationRequirement}`);
  if (f.ownerResidency)
    lines.push(`Owner residency: ${f.ownerResidency}`);
  if (f.limitations) lines.push(f.limitations);

  if (f.customerPay.length === 0 && f.settlement.length === 0) {
    lines.push(
      "Separate questions — whether your customers can pay, and where funds can settle — are not covered by application eligibility and are not verified in our data for this provider."
    );
  }

  return `## Where you can apply\n\n${lines.join("\n\n")}`;
}

function sectionIndustries(f: ProviderFacts): string | null {
  if (f.industries.length === 0) return null;
  const buckets = new Map<string, string[]>();
  for (const i of f.industries) {
    const key = i.status;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(i.name);
  }
  const verb = (list?: string[], plural = "are", singular = "is") =>
    (list?.length ?? 0) > 1 ? plural : singular;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const lines: string[] = [];
  const sup = buckets.get("supported");
  if (sup?.length)
    lines.push(
      `Standard acceptance is recorded for ${joinNames(sup)}.`
    );
  const cond = buckets.get("conditional");
  if (cond?.length)
    lines.push(
      `${cap(joinNames(cond))} may be accepted case-by-case — expect extra underwriting questions or documentation.`
    );
  const restr = buckets.get("restricted");
  if (restr?.length)
    lines.push(
      `${cap(joinNames(restr))} ${verb(restr, "appear", "appears")} on the provider's restricted-businesses terms, which usually means prior written approval or an outright decline depending on specifics.`
    );
  const proh = buckets.get("prohibited");
  if (proh?.length)
    lines.push(
      `${cap(joinNames(proh))} ${verb(proh, "are", "is")} prohibited; applying under ${proh.length > 1 ? "these categories" : "this category"} risks termination and frozen funds.`
    );
  const unv = buckets.get("unverified");
  if (unv?.length)
    lines.push(
      `Acceptance of ${joinNames(unv)} is unverified — ask the provider's sales or risk team before relying on it.`
    );
  lines.push(
    "Industry lists describe categories, not guarantees: two businesses in the same industry can receive different decisions based on underwriting."
  );
  return `## Industries it serves\n\n${lines.join("\n\n")}`;
}

function sectionPricing(f: ProviderFacts): string {
  const disclosed = f.pricing.filter((p) => p.disclosed);
  const undisclosed = f.pricing.filter((p) => !p.disclosed);
  const lines: string[] = [];

  if (f.pricing.length === 0) {
    lines.push(
      `${f.name} does not publish — or we have not captured — its processing fees. In that case the effective rate depends on your volume, risk profile, and negotiated contract; request a written quote and compare the all-in cost, not a headline percentage.`
    );
  } else {
    const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    for (const t of disclosed) {
      lines.push(
        `- **${t.label}** — ${t.display}${t.region ? ` (${t.region})` : ""}${t.conditions ? `. ${capFirst(t.conditions)}` : ""}`
      );
    }
    for (const t of undisclosed) {
      lines.push(
        `- **${t.label}** — not publicly disclosed${t.conditions ? `; ${t.conditions}` : ""}`
      );
    }
  }

  const hasFixed = disclosed.some((t) => /fixed|per transaction/i.test(t.label));
  const hasPct = disclosed.some((t) => /%/.test(t.display));
  if (hasPct && hasFixed)
    lines.push(
      "Both a percentage and a fixed per-transaction charge apply, so your blended rate rises as average ticket size falls — merchants selling low-priced items should model this before committing."
    );
  if (f.category === "mor")
    lines.push(
      "The headline rate bundles services a normal processor leaves to you (tax registration, remittance, some fraud liability). Comparing it against a bare processing rate understates what it replaces."
    );

  return `## Fees and other costs\n\n${lines.join("\n\n")}`;
}

function sectionPayouts(f: ProviderFacts): string | null {
  if (f.reserves.length === 0) return null;
  const lines = f.reserves.map((r) => {
    const bits: string[] = [r.summary.replace(/[.;\s]+$/, "")];
    if (r.percent != null) bits.push(`reported around ${r.percent}%`);
    if (r.daysMin != null)
      bits.push(
        r.daysMax != null
          ? `roughly ${r.daysMin}–${r.daysMax} days`
          : `around ${r.daysMin} day${r.daysMin === 1 ? "" : "s"}`
      );
    if (r.conditions) bits.push(r.conditions.replace(/\.$/, ""));
    const kind = r.kind.replace(/_/g, " ");
    return `- **${kind.charAt(0).toUpperCase() + kind.slice(1)}** — ${bits.join("; ")}`;
  });
  const hasReserve = f.reserves.some((r) => r.kind === "rolling_reserve");
  const tail = hasReserve
    ? "If a rolling reserve applies to your account, a slice of each payout is withheld — for a business running on thin margins this is a cash-flow commitment, not an abstract risk term. Get the percentage and release schedule in writing."
    : "Reserve policies are typically account-specific and disclosed during underwriting rather than on a public page; ask before your first settlement rather than after.";
  return `## Reserves, settlements, and payouts\n\n${lines.join("\n\n")}\n\n${tail}`;
}

function sectionCapabilities(f: ProviderFacts): string | null {
  const items: string[] = [];
  if (f.paymentTypeLabels.length > 0)
    items.push(`Payment flows: ${joinNames(f.paymentTypeLabels.map((x) => x.toLowerCase()))}.`);
  const featureNames: Record<string, string> = {
    api: "a developer API",
    plugins: "ecommerce plugins",
    hosted_checkout: "hosted checkout pages",
    recurring_billing: "recurring billing tools",
    invoicing: "invoicing",
    marketplace_tools: "marketplace/split-payment tooling",
    pos: "in-person point of sale",
    virtual_terminal: "a virtual terminal",
  };
  const supported = f.features
    .filter((x) => x.status === "supported" && featureNames[x.key])
    .map((x) => featureNames[x.key]);
  if (supported.length > 0)
    items.push(`Integration surface includes ${joinNames(supported)}.`);
  if (items.length === 0) return null;
  return `## Integration and payment capabilities\n\n${items.join("\n\n")}`;
}

function sectionApplication(f: ProviderFacts): string | null {
  if (f.applicationSteps.length === 0 && f.requiredDocs.length === 0) return null;
  const parts: string[] = [];
  if (f.applicationSteps.length > 0)
    parts.push(
      `The published onboarding path runs:\n\n${f.applicationSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    );
  if (f.requiredDocs.length > 0)
    parts.push(
      `Expect to provide:\n\n${f.requiredDocs.map((d) => `- ${d}`).join("\n")}`
    );
  return `## Applying\n\n${parts.join("\n\n")}`;
}

function sectionTradeOffs(f: ProviderFacts): string | null {
  if (f.pros.length === 0 && f.cons.length === 0) return null;
  const parts: string[] = [];
  if (f.pros.length > 0)
    parts.push(
      `Points in its favor:\n\n${f.pros.map((s) => `- ${s}`).join("\n")}`
    );
  if (f.cons.length > 0)
    parts.push(
      `Points against it:\n\n${f.cons.map((s) => `- ${s}`).join("\n")}`
    );
  parts.push(
    "These are structural observations from the provider's model and published terms — not user reviews or satisfaction ratings, which we do not collect or fabricate."
  );
  return `## Strengths and drawbacks\n\n${parts.join("\n\n")}`;
}

function sectionQuestions(f: ProviderFacts): string {
  const qs: string[] = [];
  if (f.merchantApply.conditional.length > 0)
    qs.push(
      `Is my business entity in ${f.merchantApply.conditional[0].name} actually eligible, and under what conditions?`
    );
  if (f.industries.some((i) => ["restricted", "conditional"].includes(i.status)))
    qs.push(
      "Will underwriting accept my specific business model — not just my broad industry label?"
    );
  if (!f.pricing.some((p) => p.disclosed))
    qs.push("What is the all-in rate for my expected volume and average ticket?");
  if (
    f.reserves.some((r) => r.kind === "rolling_reserve") ||
    f.category === "high_risk" ||
    f.category === "payfac"
  )
    qs.push("What reserve percentage applies to my account, and when is it released?");
  if (f.settlement.length === 0)
    qs.push("What are the payout schedule and currency options for my settlement country?");
  if (qs.length < 3)
    qs.push("Which contract terms are negotiable at my volume?");
  return `## Questions to ask before applying\n\n${qs.slice(0, 6).map((q) => `- ${q}`).join("\n")}`;
}

function sectionGapsAndSources(f: ProviderFacts): string {
  const parts: string[] = [];
  if (f.dataGaps.length > 0)
    parts.push(
      `## What isn't public\n\nOur research could not verify the following from official material: ${joinNames(f.dataGaps)}. Absence of information is not evidence of a policy either way — confirm directly with ${f.name}.`
    );
  if (f.sources.length > 0) {
    const refs = f.sources
      .slice(0, 8)
      .map((s) => `- [${s.title ?? s.host}](${s.url})`);
    parts.push(`## Official references\n\n${refs.join("\n")}`);
  }
  if (f.lastVerifiedAt)
    parts.push(
      `*Provider data last checked ${f.lastVerifiedAt.slice(0, 10)}. Terms change; verify current details on the official site before applying.*`
    );
  else
    parts.push(
      `*Record seeded from public documentation; automated verification is scheduled but has not yet confirmed every field.*`
    );
  return parts.join("\n\n");
}

/* ------------------------------------------------------------------ */
/* public writers                                                      */
/* ------------------------------------------------------------------ */

/** "## Foo" -> "- [Foo](#foo)" markdown TOC entries. */
function tableOfContents(body: string): string | null {
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  if (headings.length < 3) return null;
  const lines = headings.map((h) => {
    const anchor = h
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    return `- [${h}](#${anchor})`;
  });
  return `## Contents\n\n${lines.join("\n")}`;
}

/** Assemble a body: intro + TOC (when long enough) + sections + review note. */
export function assembleArticle(
  intro: string,
  sections: string[],
  opts: { reviewedOn?: string; methodologyNote?: string } = {}
): string {
  const core = `${intro}\n\n${sections.join("\n\n")}`;
  const toc = tableOfContents(core);
  const parts = toc
    ? [intro, toc, ...sections]
    : [intro, ...sections];
  const reviewed = opts.reviewedOn ?? new Date().toISOString().slice(0, 10);
  parts.push(
    `*Last reviewed ${reviewed}.${opts.methodologyNote ? ` ${opts.methodologyNote}` : ""} Facts are drawn from the official sources cited below; where we could not verify something we say so rather than fill the gap.*`
  );
  return parts.join("\n\n");
}

export function writeProviderProfile(f: ProviderFacts): DraftOutput {
  const sections = [
    sectionOverview(f),
    sectionEligibility(f),
    sectionIndustries(f),
    sectionPricing(f),
    sectionPayouts(f),
    sectionCapabilities(f),
    sectionApplication(f),
    sectionTradeOffs(f),
    sectionQuestions(f),
    sectionGapsAndSources(f),
  ].filter((s): s is string => !!s);

  const body = assembleArticle(sections[0], sections.slice(1), {
    reviewedOn: f.lastVerifiedAt?.slice(0, 10),
    methodologyNote: `See the [${f.name} profile page](/providers/${f.slug}) for the structured facts this article is built from.`,
  });
  return {
    title: `${f.name}: fees, eligibility, and requirements`,
    summary: `What ${f.name} offers, which merchants and industries it accepts, published fees and payout terms — based on official sources, with unknowns stated plainly.`,
    body,
  };
}

export function writeComparison(
  a: ProviderFacts,
  b: ProviderFacts
): DraftOutput {
  const parts: string[] = [];
  parts.push(
    `${a.name} and ${b.name} solve overlapping problems through different models: the former is a ${a.categoryLabel.toLowerCase()}${a.hq ? ` (${a.hq})` : ""}, the latter a ${b.categoryLabel.toLowerCase()}${b.hq ? ` (${b.hq})` : ""}. This page compares them only on differences our records actually evidence — not on marketing claims.`
  );

  // Eligibility contrast — compare full status maps so conditional
  // acceptance is never flattened into "does not accept".
  const statusMap = (f: ProviderFacts) => {
    const m = new Map<
      string,
      { status: string; name: string; evidenceLinked?: boolean }
    >();
    for (const c of [
      ...f.merchantApply.supported,
      ...f.merchantApply.conditional,
      ...f.merchantApply.notSupported,
      ...f.merchantApply.unverified,
    ])
      m.set(c.code, {
        status: c.status,
        name: c.name,
        evidenceLinked: c.evidenceLinked,
      });
    return m;
  };
  const STATUS_WORDING: Record<string, string> = {
    supported: "accepts applications",
    conditional: "accepts conditionally",
    not_supported: "does not accept applications",
    unverified: "is unverified",
  };
  const wording = (
    name: string,
    s?: { status: string; evidenceLinked?: boolean }
  ) => {
    if (!s) return `${name} has no record — eligibility there is unknown, not confirmed absent`;
    const w = STATUS_WORDING[s.status] ?? `records "${s.status}"`;
    // A claim without an evidence link is a seed value — it must not read
    // as verified fact.
    const tag = s.evidenceLinked ? "" : " *(unverified record)*";
    return `${name} ${w}${tag}`;
  };
  const aMap = statusMap(a);
  const bMap = statusMap(b);
  const eligLines: string[] = [];
  for (const code of new Set([...aMap.keys(), ...bMap.keys()])) {
    const sa = aMap.get(code);
    const sb = bMap.get(code);
    const name = sa?.name ?? sb?.name ?? code;
    if (sa?.status === sb?.status && sa?.evidenceLinked === sb?.evidenceLinked)
      continue;
    eligLines.push(`- **${name}**: ${wording(a.name, sa)}; ${wording(b.name, sb)}.`);
  }
  if (eligLines.length > 0)
    parts.push(
      `## Merchant eligibility\n\n${eligLines.join("\n")}\n\nStatus words come from official sources or our records; *(unverified record)* marks a directory seed value not yet checked against an official source, and "no record" means we lack evidence either way.`
    );

  // Pricing contrast — only disclosed figures; unverified rows are labeled
  // so seed values never read as published facts.
  const feeLines: string[] = [];
  for (const [f, terms] of [
    [a.name, a.pricing],
    [b.name, b.pricing],
  ] as const)
    for (const t of terms.filter((x) => x.disclosed).slice(0, 4))
      feeLines.push(
        `- ${f}: ${t.label} — ${t.display}${t.evidenceLinked ? "" : " *(unverified)*"}${t.conditions ? ` (${t.conditions})` : ""}`
      );
  if (feeLines.length > 0)
    parts.push(
      `## Published pricing\n\n${feeLines.join("\n")}\n\nHeadline percentages are not total cost: fixed per-transaction fees, FX markup, and reserve terms change the math for different ticket sizes. Rows marked *(unverified)* come from directory records we have not yet confirmed on the provider's pricing page.`
    );

  // Industry contrast
  const aInd = new Map(a.industries.map((i) => [i.slug, i]));
  const bInd = new Map(b.industries.map((i) => [i.slug, i]));
  const diffs = [...aInd.entries()]
    .filter(([slug, i]) => bInd.has(slug) && bInd.get(slug)!.status !== i.status)
    .map(
      ([, i]) =>
        `- ${i.name}: ${a.name} records "${i.statusLabel.toLowerCase()}", ${b.name} records "${bInd.get(i.slug)!.statusLabel.toLowerCase()}"`
    );
  if (diffs.length > 0)
    parts.push(`## Industry acceptance\n\n${diffs.join("\n")}`);

  // Fit summary — decision guidance, not a winner
  const fitLines: string[] = [];
  if (a.suitableFor) fitLines.push(`${a.name} suits: ${a.suitableFor.replace(/\.$/, "")}.`);
  if (b.suitableFor) fitLines.push(`${b.name} suits: ${b.suitableFor.replace(/\.$/, "")}.`);
  fitLines.push(
    "Neither is universally better: eligibility for your country and industry, plus your tolerance for the cost model, decides which is worth applying to first."
  );
  parts.push(`## Which fits your business\n\n${fitLines.join("\n\n")}`);

  const srcs = [
    ...new Map(
      [...a.sources, ...b.sources].map((s) => [s.url, s])
    ).values(),
  ].slice(0, 8);
  if (srcs.length > 0)
    parts.push(
      `## Official references\n\n${srcs
        .map((s) => `- [${s.title ?? s.host}](${s.url})`)
        .join("\n")}`
    );

  const body = assembleArticle(parts.shift()!, parts, {
    methodologyNote: `Compare the structured records: [${a.name}](/providers/${a.slug}) and [${b.name}](/providers/${b.slug}).`,
  });
  return {
    title: `${a.name} vs ${b.name}: eligibility, fees, and differences`,
    summary: `An evidence-based comparison of ${a.name} and ${b.name}: where each accepts merchants, published fees, industry restrictions, and who each model suits.`,
    body,
  };
}

/* ------------------------------------------------------------------ */
/* educational articles — original explainers with labeled examples    */
/* ------------------------------------------------------------------ */

export const ARTICLE_TOPICS = [
  "rolling-reserves",
  "chargebacks",
  "interchange-fees",
  "settlement-delays",
  "merchant-account-termination",
  "high-risk-merchants",
] as const;
export type ArticleTopic = (typeof ARTICLE_TOPICS)[number];

interface ArticleSpec {
  title: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
  example?: { label: string; lines: string[] };
  questions: string[];
}

const ARTICLES: Record<ArticleTopic, ArticleSpec> = {
  "rolling-reserves": {
    title: "Rolling reserves explained: what they cost your cash flow",
    intro:
      "A rolling reserve withholds a percentage of each payout to cover future chargebacks and refunds, then releases it after a set period. It is one of the least understood — and most cash-flow-relevant — terms in a processing agreement.",
    sections: [
      {
        heading: "How a rolling reserve works",
        paragraphs: [
          "Instead of settling every dollar the day it clears, the processor holds back a fixed percentage of each batch — commonly for a window like 90 or 180 days. Funds withheld today are released later on a rolling schedule, which is where the name comes from.",
          "Reserves exist because processing is credit-like: when a customer disputes a charge weeks after delivery, the processor is on the hook if the merchant's account can't cover the refund. Withholding part of the payout is the processor's insurance.",
        ],
      },
      {
        heading: "Who typically gets one",
        paragraphs: [
          "New merchants, high-risk verticals, and businesses with chargeback rates above industry norms are the usual candidates. Reserve terms are set during underwriting — they are rarely negotiable after the fact, so ask before signing.",
          "Not every account carries a reserve, and the absence of a public reserve policy doesn't mean none will be applied; most providers reserve the right to impose one if risk changes.",
        ],
      },
      {
        heading: "What it costs in practice",
        paragraphs: [
          "The real cost isn't the withheld money itself — you'll usually get it back — it's the working capital tied up. A merchant running on thin margins can find the reserve, not the processing fee, is the binding constraint on growth.",
        ],
      },
    ],
    example: {
      label:
        "Illustrative example — these numbers are invented for explanation, not any provider's actual terms",
      lines: [
        "Suppose a provider withholds 10% of each payout for 180 days.",
        "Month 1: you process $50,000 → $5,000 held. Months 1–6 repeat identically.",
        "At month 7, month-1's $5,000 releases while month-7's $5,000 is held — the balance plateaus at $30,000 withheld.",
        "If volume doubles to $100,000/month, the plateau doubles to $60,000: growth itself expands the reserve requirement.",
      ],
    },
    questions: [
      "What percentage applies to my account, and for how long?",
      "Is the reserve based on gross volume or net of refunds?",
      "Can the reserve percentage be re-evaluated after clean processing history?",
      "What events trigger an increase or a shift to a capped reserve?",
    ],
  },
  "chargebacks": {
    title: "Chargebacks: how they work, what they cost, and how to reduce them",
    intro:
      "A chargeback reverses a card payment when a cardholder disputes it through their bank. Beyond the refunded amount itself, chargebacks carry fees, consume staff time, and — at high enough rates — threaten the merchant account itself.",
    sections: [
      {
        heading: "The lifecycle",
        paragraphs: [
          "The cardholder contacts their bank, which pulls the funds back through the card network. The merchant can accept the chargeback or contest it with evidence — delivery records, signed agreements, usage logs — through a process called representment.",
          "Win rates vary by dispute reason and evidence quality. 'Fraud' disputes are harder to win than 'item not received' for a merchant with tracking proof.",
        ],
      },
      {
        heading: "The real cost",
        paragraphs: [
          "Each dispute typically costs the transaction amount, a per-dispute fee charged regardless of outcome, and the operational time to gather evidence. Networks also monitor your chargeback-to-transaction ratio — sustained excess triggers monitoring programs with escalating penalties.",
        ],
      },
      {
        heading: "Reducing them",
        paragraphs: [
          "Clear billing descriptors, accessible customer service, and honest product descriptions prevent more disputes than any representment strategy. Fraud tooling (address verification, 3-D Secure where appropriate) shifts some liability but adds friction — the right level depends on your fraud rate, not a default setting.",
        ],
      },
    ],
    questions: [
      "What is the per-dispute fee, and is it refunded if I win?",
      "What evidence format does the provider's representment flow accept?",
      "At what ratio does the provider escalate or restrict my account?",
    ],
  },
  "interchange-fees": {
    title: "Interchange, assessments, and markup: where processing fees go",
    intro:
      "The percentage on your processing statement isn't one fee — it's three. Understanding the split explains why '2.9%' means different things on different providers and when interchange-plus pricing is worth asking for.",
    sections: [
      {
        heading: "The three components",
        paragraphs: [
          "Interchange goes to the cardholder's issuing bank and is set by the card networks — no processor controls it. Assessments (or scheme fees) go to the networks themselves. Markup is the processor's cut, and it's the only negotiable part.",
          "Blended pricing bundles all three into one rate — simple to understand, impossible to audit. Interchange-plus pricing passes the first two through at cost and adds a stated markup, which larger merchants can negotiate down.",
        ],
      },
      {
        heading: "Why the same card costs different merchants different amounts",
        paragraphs: [
          "Interchange varies by card type, entry method, and merchant category. A rewards credit card keyed in manually costs more to process than a debit card dipped in person — under flat-rate pricing you pay the provider's blend regardless.",
        ],
      },
    ],
    example: {
      label:
        "Illustrative example — invented figures showing structure, not actual interchange tables",
      lines: [
        "A $100 sale on a standard rewards card might carry ~1.8% interchange + ~0.15% assessments.",
        "On flat-rate 2.9% + $0.30 pricing you'd pay $3.20 — of which roughly $1.25 is the processor's margin.",
        "On interchange+0.5% + $0.10 the same sale costs ~$2.05 — but a premium card could price higher than the flat rate, so volume mix matters.",
      ],
    },
    questions: [
      "Is pricing blended or interchange-plus, and what's the markup?",
      "Are downgrade fees passed through for non-qualified transactions?",
      "What does the effective rate look like at my average ticket size?",
    ],
  },
  "settlement-delays": {
    title: "Why payouts take days: settlement timing and cash-flow planning",
    intro:
      "The gap between a customer's card being charged and money landing in your bank isn't arbitrary delay — it's batching, network settlement windows, and risk holds stacked together.",
    sections: [
      {
        heading: "What happens between charge and deposit",
        paragraphs: [
          "Transactions batch at end of day, clear through the card networks, then settle to the acquirer, which finally pays the merchant. Each step has its own cutoff times — miss a batch cutoff and the clock effectively restarts tomorrow.",
          "Weekend and holiday cutoffs stretch nominal 'T+2' schedules. A Friday charge often settles Monday or Tuesday, making the effective delay four days for merchants who process heavily on weekends.",
        ],
      },
      {
        heading: "Risk holds are different from settlement",
        paragraphs: [
          "A standard schedule is predictable; a risk hold is not. Processors can delay specific payouts pending review — common for new accounts, sudden volume spikes, or unusual transaction patterns — and these operate on top of the normal schedule.",
        ],
      },
      {
        heading: "Planning around it",
        paragraphs: [
          "Map your payout schedule against fixed costs. Instant-transfer products exist at most providers for a fee — worth modeling against the cost of short-term credit if cash flow is tight.",
        ],
      },
    ],
    questions: [
      "What is the standard payout schedule for my country?",
      "What events can delay a payout beyond the schedule?",
      "What does instant or same-day settlement cost?",
    ],
  },
  "merchant-account-termination": {
    title: "When processors freeze or close accounts: prevention and response",
    intro:
      "Account termination — or its quieter cousin, the indefinite payout hold — is the single highest-severity operational risk of using a third-party processor. It is also largely preventable.",
    sections: [
      {
        heading: "Why it happens",
        paragraphs: [
          "The triggers are usually chargeback spikes, business-model drift (selling something different from what you were underwritten for), prohibited-category transactions, or documentation the processor requested and never received. Automated risk systems flag first and investigate after — which is why holds can feel arbitrary.",
          "Payment facilitators terminate fastest because their pooled structure makes one risky merchant a problem for every other merchant sharing the pool.",
        ],
      },
      {
        heading: "Prevention",
        paragraphs: [
          "Underwrite honestly: describe what you actually sell, update the provider when the business changes, and keep chargeback rates controlled. Merchants terminated for misrepresentation rarely get accounts back anywhere.",
        ],
      },
      {
        heading: "If it happens to you",
        paragraphs: [
          "Funds held at termination can be retained for months under the agreement's reserve terms. A backup processing relationship — even an unused one — turns an existential event into a painful week.",
        ],
      },
    ],
    questions: [
      "Under what conditions can the provider hold funds beyond a reserve?",
      "What is the documented appeal or review process?",
      "Is a backup account or gateway integration feasible for my stack?",
    ],
  },
  "high-risk-merchants": {
    title: "High-risk merchant accounts: when you need one and what they cost",
    intro:
      "'High risk' isn't a judgment about your business quality — it's a category assignment by card networks and acquiring banks, driven mostly by chargeback exposure and regulatory complexity.",
    sections: [
      {
        heading: "What makes a business high-risk",
        paragraphs: [
          "The usual drivers: future-delivery products (travel, subscriptions with trial billing), regulated categories (supplements, financial services, firearms), high average chargeback rates, or a merchant history that includes previous terminations.",
          "Mainstream providers publish prohibited-business lists; landing near the edge of one usually means a specialist underwriter, not necessarily a different business.",
        ],
      },
      {
        heading: "What high-risk accounts actually cost",
        paragraphs: [
          "Expect higher percentages, setup fees, rolling reserves, and longer contracts than standard processing — these are the price of an acquiring bank willing to absorb your category's dispute rate. Quote-based pricing dominates, which makes written comparison between specialists worthwhile.",
        ],
      },
      {
        heading: "Choosing a specialist",
        paragraphs: [
          "Brokers place you with partner banks; direct high-risk acquirers underwrite in-house. Ask which acquirer your account actually lands with — the entity holding your money matters more than the one whose name is on the application.",
        ],
      },
    ],
    questions: [
      "Which acquiring bank will my account sit with?",
      "What reserve percentage and duration apply to my category?",
      "Are there early-termination fees or auto-renewing terms?",
    ],
  },
};

export function writeArticle(topic: ArticleTopic): DraftOutput | null {
  const spec = ARTICLES[topic];
  if (!spec) return null;

  const parts: string[] = [spec.intro];
  for (const s of spec.sections) {
    parts.push(`## ${s.heading}\n\n${s.paragraphs.join("\n\n")}`);
  }
  if (spec.example) {
    parts.push(
      `## Worked example\n\n*${spec.example.label}.*\n\n${spec.example.lines.map((l) => `- ${l}`).join("\n")}`
    );
  }
  parts.push(
    `## Questions to ask a provider\n\n${spec.questions.map((q) => `- ${q}`).join("\n")}`
  );
  parts.push(
    `*This is general educational material, not financial or legal advice, and does not describe any specific provider's terms.*`
  );

  return {
    title: spec.title,
    summary: spec.intro.slice(0, 160).replace(/\s+\S*$/, "") + "…",
    body: assembleArticle(spec.intro, parts.slice(1), {
      methodologyNote:
        "This guide explains concepts; it is not drawn from any single provider's terms.",
    }),
  };
}

/* ------------------------------------------------------------------ */
/* data-driven articles — built from normalized facts, not templates    */
/* ------------------------------------------------------------------ */

function countryStatus(f: ProviderFacts, code: string): string {
  const hit = (l: { code: string }[]) => l.some((c) => c.code === code);
  if (hit(f.merchantApply.supported)) return "supported";
  if (hit(f.merchantApply.conditional)) return "conditional";
  if (hit(f.merchantApply.notSupported)) return "not_supported";
  return "unverified";
}

/**
 * Country eligibility roundup — "which providers accept merchants in X".
 * Only generated when the directory has at least one positive claim for the
 * country; unsupported/unknown is stated rather than implied.
 */
export function writeCountryRoundup(
  country: { code: string; name: string },
  providers: ProviderFacts[]
): DraftOutput | null {
  // Business-formation services are not payment processors — the title
  // promises processors, so they get their own clearly-labeled section
  // instead of being mixed into the accept/conditional lists.
  const isFormation = (f: ProviderFacts) => f.category === "formation";
  const payments = providers.filter((f) => !isFormation(f));
  const formation = providers.filter(isFormation);

  const supported = payments.filter(
    (f) => countryStatus(f, country.code) === "supported"
  );
  const conditional = payments.filter(
    (f) => countryStatus(f, country.code) === "conditional"
  );
  const excluded = payments.filter(
    (f) => countryStatus(f, country.code) === "not_supported"
  );
  if (supported.length === 0 && conditional.length === 0) return null;

  const link = (f: ProviderFacts) => `[${f.name}](/providers/${f.slug})`;
  const feeNote = (f: ProviderFacts) =>
    f.pricing
      .filter((t) => t.disclosed)
      .map((t) => `${t.label}: ${t.display}${t.evidenceLinked ? "" : " (unverified)"}`)
      .join("; ");

  const sections: string[] = [];
  if (supported.length > 0) {
    sections.push(
      `## Providers that accept ${country.name}-registered businesses\n\n${supported
        .map((f) => {
          const fees = feeNote(f);
          return `- **${link(f)}** — ${f.categoryLabel.toLowerCase()}${fees ? `; recorded terms include ${fees}` : ""}`;
        })
        .join("\n")}`
    );
  }
  if (conditional.length > 0) {
    sections.push(
      `## Conditional or restricted acceptance\n\nThese providers may accept ${country.name} businesses depending on entity type, underwriting, or product fit — conditions are listed where our records hold them.\n\n${conditional
        .map(
          (f) =>
            `- **${link(f)}** — ${f.categoryLabel.toLowerCase()}${f.registrationRequirement ? `; requirement noted: ${f.registrationRequirement}` : ""}`
        )
        .join("\n")}`
    );
  }
  if (excluded.length > 0) {
    sections.push(
      `## Providers our records show as unavailable\n\n${excluded
        .map((f) => `- ${link(f)}`)
        .join("\n")}`
    );
  }
  if (formation.length > 0) {
    sections.push(
      `## Business formation services\n\nThese are not payment processors — they form and maintain business entities (${country.name}- or foreign-owned). If a provider above requires an entity type you do not have, a formation service may be the prerequisite step.\n\n${formation
        .map((f) => `- **${link(f)}** — ${f.summary ?? "business formation service"}`)
        .join("\n")}`
    );
  }
  sections.push(
    `## How to choose\n\n- **If a direct fit exists** (${supported.length} provider${supported.length === 1 ? "" : "s"}), start there — apply to the one whose industry list and fee model match your business.\n- **If everything is conditional**, the deciding factor is usually entity type and underwriting tolerance, not price.\n- **Verify before signing**: a provider's presence on a supported-country page does not guarantee approval; underwriting still applies.\n\nCheck each provider's profile for the evidence-linked eligibility row before applying.`
  );

  const srcs = [
    ...new Map(
      providers.flatMap((f) => f.sources).map((s) => [s.url, s])
    ).values(),
  ].slice(0, 8);
  if (srcs.length > 0)
    sections.push(
      `## Official references\n\n${srcs
        .map((s) => `- [${s.title ?? s.host}](${s.url})`)
        .join("\n")}`
    );

  const article = /^[aeiou]/i.test(country.name) ? "An" : "A";
  const body = assembleArticle(
    `${article} ${country.name}-registered business does not have the same provider menu as a US or EU one — eligibility is per-country, and several major names exclude or conditionally accept ${country.name} merchants. This page lists what our records actually show, separated into clear accepts, conditional cases, and recorded exclusions.`,
    sections,
    {
      methodologyNote: `Browse the [${country.name} country page](/countries/${country.code.toLowerCase()}) for the underlying eligibility data.`,
    }
  );
  return {
    title: `Payment processors that accept ${country.name} merchants`,
    summary: `Which payment providers accept ${country.name}-registered businesses — clear accepts, conditional cases, and recorded exclusions, from evidence-linked records.`,
    body,
  };
}

/**
 * Foreign-founders guide — which providers accept non-resident founders and
 * foreign-owned US entities, drawn from registration/residency fact fields.
 */
export function writeForeignFoundersGuide(
  payments: ProviderFacts[],
  formation: ProviderFacts[]
): DraftOutput {
  const accepting = payments.filter((f) =>
    /foreign|non.?resident|international|any countr/i.test(
      `${f.registrationRequirement ?? ""} ${f.ownerResidency ?? ""} ${f.summary ?? ""}`
    )
  );
  const sections: string[] = [
    `## The core problem\n\nMost US-based payment providers underwrite against a US entity and a US-resident owner. Foreign founders typically need a US entity first, then a provider that will accept a non-resident owner — two separate gates that fail independently.`,
    `## Payment providers on record for foreign founders\n\n${
      accepting.length > 0
        ? accepting
            .map(
              (f) =>
                `- **${`[${f.name}](/providers/${f.slug})`}** — ${f.categoryLabel.toLowerCase()}${f.ownerResidency ? `; residency note: ${f.ownerResidency}` : ""}`
            )
            .join("\n")
        : "Our records do not currently verify any payment provider's non-resident-owner acceptance; ask each provider directly — marketing pages rarely state it."
    }\n\nThe other route is a Merchant of Record, which sells under its own entity and largely sidesteps residency requirements.`,
    `## Formation providers\n\n${
      formation.length > 0
        ? formation
            .map(
              (f) =>
                `- **${`[${f.name}](/providers/${f.slug})`}** — ${f.summary ?? f.categoryLabel.toLowerCase()}`
            )
            .join("\n")
        : "See the business-formation section for providers that handle foreign-owned US LLC formation."
    }`,
    `## What to verify before applying\n\n- Whether the provider underwrites the OWNER, the entity, or both.\n- Whether a US EIN alone is enough, or a US-resident signer is required.\n- Which industries are excluded for foreign-owned entities specifically (often stricter than the general list).\n- Payout banking: many require a US bank account in the entity's name.`,
  ];
  const srcs = [
    ...new Map(
      [...payments, ...formation]
        .flatMap((f) => f.sources)
        .map((s) => [s.url, s])
    ).values(),
  ].slice(0, 8);
  if (srcs.length > 0)
    sections.push(
      `## Official references\n\n${srcs
        .map((s) => `- [${s.title ?? s.host}](${s.url})`)
        .join("\n")}`
    );

  const body = assembleArticle(
    `Non-US founders asking "which payment processor can I use" usually discover the answer depends on two separate eligibility checks — whether the entity type is accepted, and whether the owner's residency is. This guide lays out what our records show for each.`,
    sections
  );
  return {
    title:
      "Payment processing for foreign founders and foreign-owned US LLCs",
    summary:
      "Which payment providers and formation services work for non-US founders — the entity and residency gates, verified where evidence exists.",
    body,
  };
}
