/**
 * Controlled vocabularies for the data model.
 * These string unions replace DB enums so the schema stays portable
 * between SQLite (dev) and PostgreSQL (prod).
 */

export const SITE_NAME = "PayGate Directory";
export const SITE_TAGLINE =
  "Independent research on payment gateways, processors, and merchant account providers";

// -- Provider categories -----------------------------------------------------

export const PROVIDER_CATEGORIES = [
  "payment_gateway",
  "payment_processor",
  "merchant_account",
  "high_risk",
  "payfac",
  "mor",
  "orchestration",
  "subscription_billing",
  "formation",
  "regional",
  "other",
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  payment_gateway: "Payment Gateway",
  payment_processor: "Payment Processor",
  merchant_account: "Merchant Account Provider",
  high_risk: "High-Risk Specialist",
  payfac: "Payment Facilitator",
  mor: "Merchant of Record",
  orchestration: "Payment Orchestration",
  subscription_billing: "Subscription Billing",
  formation: "Business Formation",
  regional: "Regional Provider",
  other: "Other",
};

// -- Eligibility scopes -------------------------------------------------------

export const ELIGIBILITY_SCOPES = [
  "merchant_apply",
  "customer_pay",
  "settlement",
] as const;
export type EligibilityScope = (typeof ELIGIBILITY_SCOPES)[number];

export const SCOPE_LABELS: Record<EligibilityScope, string> = {
  merchant_apply: "Merchants can apply from",
  customer_pay: "Customers can pay from",
  settlement: "Settlement supported in",
};

// -- Verification / support statuses ------------------------------------------

export const SUPPORT_STATUSES = [
  "supported",
  "not_supported",
  "conditional",
  "undisclosed",
  "conflicting",
  "unverified",
  "outdated",
] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const STATUS_LABELS: Record<SupportStatus, string> = {
  supported: "Supported",
  not_supported: "Not supported",
  conditional: "Conditionally supported",
  undisclosed: "Not publicly disclosed",
  conflicting: "Conflicting evidence",
  unverified: "Unverified",
  outdated: "Outdated",
};

// Industry acceptance adds "restricted" and "prohibited".
export const INDUSTRY_STATUSES = [
  "supported",
  "conditional",
  "restricted",
  "prohibited",
  "unverified",
] as const;
export type IndustryStatus = (typeof INDUSTRY_STATUSES)[number];

export const INDUSTRY_STATUS_LABELS: Record<IndustryStatus, string> = {
  supported: "Accepted",
  conditional: "Conditionally accepted",
  restricted: "Restricted",
  prohibited: "Prohibited",
  unverified: "Unverified",
};

// -- Payment types --------------------------------------------------------------

export const PAYMENT_TYPES = ["one_time", "recurring", "marketplace"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  one_time: "One-time payments",
  recurring: "Recurring / subscriptions",
  marketplace: "Marketplace / split payments",
};

// -- Misc -----------------------------------------------------------------------

export const JOB_TYPES = [
  "discover",
  "research",
  "claimify",
  "verify",
  "content",
  "affiliates",
  "report",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

// -- Content publication workflow -------------------------------------------
// Only "published" is public-facing; every other status is internal pipeline state.

export const CONTENT_STATUSES = [
  "research_pending",
  "evidence_collected",
  "facts_normalized",
  "draft",
  "quality_checking",
  "review_required",
  "approved",
  "published",
  "update_required",
  "rejected",
  "archived",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Statuses that must never appear on public pages or sitemaps. */
export const INTERNAL_STATUSES: ReadonlySet<string> = new Set(
  CONTENT_STATUSES.filter((s) => s !== "published")
);

export const AFFILIATE_STATUSES = [
  "discovered",
  "researched",
  "ready_to_apply",
  "applied",
  "approved",
  "rejected",
  "unavailable",
] as const;

/** Fields whose changes are commercially significant -> always need review. */
export const SIGNIFICANT_FIELDS = new Set([
  "pricing",
  "countries.merchant_apply",
  "countries.settlement",
  "industries",
  "reserves",
  "payouts",
  "application",
]);
