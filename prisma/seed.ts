/**
 * Seed script — idempotent (safe to re-run).
 *
 * IMPORTANT DATA-INTEGRITY RULE: everything seeded here is recorded as
 * "unverified" unless stated otherwise. Seeded facts come from well-known
 * public documentation but have NOT been fetched by the pipeline yet —
 * the verify job upgrades them when it confirms the official sources.
 *
 *   npx tsx prisma/seed.ts   (or `npm run db:seed`)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { slugify, normalizeProviderName, hostname } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

const COUNTRIES = [
  { code: "US", name: "United States", region: "North America", intro: "The largest market for online payment processing. Most global providers accept US-registered merchants, and US businesses have the widest choice of gateways, processors, and merchant account providers." },
  { code: "GB", name: "United Kingdom", region: "Europe", intro: "A major payments market with strong provider coverage. Most international providers accept UK-registered merchants." },
  { code: "IN", name: "India", region: "Asia", intro: "A large but regulated payments market. Indian merchants often need local providers (Razorpay, Cashfree, PayU, CCAvenue) or global Merchant of Record services; several major global providers restrict or invite-only Indian applications." },
  { code: "CA", name: "Canada", region: "North America", intro: "Well covered by international providers, though a few US-centric services do not onboard Canadian entities." },
  { code: "AU", name: "Australia", region: "Oceania", intro: "Good coverage from global providers; local acquirers also available. Some US-only services do not onboard Australian entities." },
  { code: "MY", name: "Malaysia", region: "Asia", intro: "Coverage is thinner: many global providers do not onboard Malaysian entities, so regional providers and Merchant of Record services are common routes." },
  { code: "SG", name: "Singapore", region: "Asia" },
  { code: "DE", name: "Germany", region: "Europe" },
  { code: "NG", name: "Nigeria", region: "Africa" },
  { code: "AE", name: "United Arab Emirates", region: "Middle East" },
];

// ---------------------------------------------------------------------------
// Industries
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  { slug: "saas", name: "SaaS & Software", risk: "standard", summary: "Software subscriptions and licensed software — generally the most widely accepted category." },
  { slug: "ecommerce", name: "Ecommerce & Retail", risk: "standard", summary: "Physical goods sold online. Widely accepted; cross-border sales may add requirements." },
  { slug: "digital-products", name: "Digital Products", risk: "standard", summary: "Downloads, courses, ebooks, templates. Widely accepted; Merchant of Record providers specialize here." },
  { slug: "subscriptions", name: "Subscription Businesses", risk: "standard", summary: "Recurring billing is supported by most providers, but continuity/subscription models face extra chargeback scrutiny." },
  { slug: "freelancers", name: "Freelancers & Agencies", risk: "standard", summary: "Service businesses invoicing clients. Most providers work; invoicing features matter." },
  { slug: "marketplaces", name: "Marketplaces", risk: "elevated", summary: "Platforms paying out to third-party sellers need split payments / connected-account products." },
  { slug: "travel", name: "Travel", risk: "high", summary: "Airlines, agencies, tours and accommodation are treated as high risk by most providers due to future-delivery chargeback exposure." },
  { slug: "supplements", name: "Supplements & Nutraceuticals", risk: "high", summary: "A classic high-risk category: many providers restrict or decline supplements, especially with health claims." },
  { slug: "forex", name: "Forex & Financial Services", risk: "high", summary: "Trading platforms, signal services, and financial products face strict licensing and are prohibited by many providers." },
  { slug: "gaming", name: "Gaming & Gambling", risk: "high", summary: "Video games are widely accepted; real-money gambling, fantasy sports, and loot mechanics are heavily restricted and license-dependent." },
  { slug: "adult", name: "Adult Content", risk: "high", summary: "Prohibited by most mainstream providers; specialist high-risk processors serve this category." },
  { slug: "crypto", name: "Crypto & Digital Assets", risk: "high", summary: "Exchanges and token sales are prohibited by most mainstream providers; some specialist acquirers serve licensed operators." },
];

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

interface SeedProvider {
  name: string;
  website: string;
  category: string;
  hq?: string;
  summary: string;
  suitableFor?: string;
  status?: string;
  merchantCountries: Record<string, string>; // code -> status
  paymentTypes?: string[];
  industries?: Record<string, string>; // industry slug -> status
  industryNotes?: Record<string, string>;
  pricing?: {
    kind: string;
    label: string;
    min?: number;
    max?: number;
    currency?: string;
    unit?: string;
    region?: string;
    conditions?: string;
  }[];
  reserves?: { kind: string; summary: string; percent?: number; daysMin?: number; daysMax?: number; conditions?: string }[];
  features?: Record<string, string>;
  requiredDocs?: string[];
  applicationSteps?: string[];
  pros?: string[];
  cons?: string[];
  limitations?: string;
  registration?: string;
  ownerResidency?: string;
  sources?: { url: string; title: string }[];
}

const STANDARD_DOCS = [
  "Business registration details (entity name, number, country)",
  "Owner / director identity documents (KYC)",
  "Business bank account details",
  "Website or product information",
];

const STANDARD_STEPS = [
  "Create an account on the provider website",
  "Submit business and owner details for verification",
  "Connect a bank account for payouts",
  "Wait for underwriting review and account approval",
  "Integrate and start processing",
];

const PROVIDERS: SeedProvider[] = [
  {
    name: "Stripe",
    website: "https://stripe.com",
    category: "payfac",
    hq: "US",
    summary:
      "Payment facilitator and API platform for online payments, subscriptions, and marketplaces.",
    suitableFor: "Online businesses of all sizes, SaaS, marketplaces, and developers needing API-first payments.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "conditional", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring", "marketplace"],
    industries: {
      saas: "supported", ecommerce: "supported", "digital-products": "supported",
      subscriptions: "supported", freelancers: "supported", marketplaces: "supported",
      travel: "restricted", supplements: "restricted", forex: "restricted",
      gaming: "conditional", adult: "prohibited", crypto: "restricted",
    },
    pricing: [
      { kind: "transaction_pct", label: "Online card payments (US)", min: 2.9, unit: "percent", region: "US", conditions: "plus $0.30 fixed per transaction; varies by country and method" },
      { kind: "transaction_fixed", label: "Fixed fee per charge (US)", min: 0.3, currency: "USD", unit: "fixed", region: "US", conditions: "part of the 2.9% + $0.30 online rate" },
      { kind: "chargeback", label: "Chargeback / dispute fee", min: 15, currency: "USD", unit: "fixed", region: "US" },
    ],
    reserves: [
      { kind: "payout_schedule", summary: "Standard payouts on a rolling schedule (typically 2 business days in the US; varies by country and risk).", daysMin: 2, conditions: "First payout can take longer; schedule varies by country." },
      { kind: "rolling_reserve", summary: "Reserves may be applied case-by-case for higher-risk accounts; terms set during underwriting.", conditions: "Not a fixed public percentage." },
    ],
    features: { api: "supported", plugins: "supported", hosted_checkout: "supported", recurring_billing: "supported", invoicing: "supported", marketplace_tools: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: STANDARD_STEPS,
    pros: ["Excellent developer APIs and documentation", "Broad product suite (Billing, Connect, Radar)", "Fast onboarding for standard businesses"],
    cons: ["Account stability relies on automated risk review", "High-risk and restricted categories often declined", "Reserves/holds can be applied without much warning"],
    limitations: "India is invite/restricted; Malaysia not supported for merchant accounts.",
    registration: "A registered business in a Stripe-supported country; sole proprietors supported in many countries.",
    sources: [
      { url: "https://stripe.com/pricing", title: "Stripe pricing" },
      { url: "https://stripe.com/legal/restricted-businesses", title: "Stripe restricted businesses" },
      { url: "https://stripe.com/global", title: "Stripe global availability" },
    ],
  },
  {
    name: "PayPal",
    website: "https://www.paypal.com",
    category: "payment_processor",
    hq: "US",
    summary: "Global payments platform offering checkout, invoicing, and card processing.",
    suitableFor: "Small to mid-size merchants wanting a recognized checkout wallet plus card acceptance.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "supported", MY: "supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", ecommerce: "supported", "digital-products": "supported",
      subscriptions: "supported", freelancers: "supported", marketplaces: "conditional",
      travel: "supported", supplements: "conditional", forex: "restricted",
      gaming: "conditional", adult: "prohibited", crypto: "restricted",
    },
    pricing: [
      { kind: "transaction_pct", label: "Online card processing (US)", min: 3.49, unit: "percent", region: "US", conditions: "plus fixed fee; PayPal Checkout rates differ" },
      { kind: "chargeback", label: "Chargeback fee", min: 20, currency: "USD", unit: "fixed", region: "US" },
    ],
    reserves: [
      { kind: "rolling_reserve", summary: "Reserves and payment holds are applied based on risk, especially for new sellers; holds up to 21 days are documented.", conditions: "Terms set per account; see PayPal funds availability policy." },
    ],
    features: { api: "supported", plugins: "supported", hosted_checkout: "supported", recurring_billing: "supported", invoicing: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: STANDARD_STEPS,
    pros: ["Instant consumer trust and wallet coverage", "Quick setup for standard businesses", "Broad country coverage"],
    cons: ["Funds holds and rolling reserves are common for new/risky accounts", "Account limitation decisions can be abrupt", "Fees higher than interchange-plus options"],
    sources: [
      { url: "https://www.paypal.com/us/business/fees", title: "PayPal merchant fees (US)" },
      { url: "https://www.paypal.com/us/legalhub/acceptableuse-full", title: "PayPal acceptable use policy" },
    ],
  },
  {
    name: "Square",
    website: "https://squareup.com",
    category: "payment_processor",
    hq: "US",
    summary: "POS and online payments for small businesses with flat-rate pricing.",
    suitableFor: "Small businesses and omnichannel sellers wanting flat-rate pricing and free POS.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "not_supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      ecommerce: "supported", subscriptions: "supported", freelancers: "supported",
      saas: "supported", "digital-products": "supported", marketplaces: "unverified",
      travel: "unverified", supplements: "restricted", forex: "prohibited",
      gaming: "unverified", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [
      { kind: "transaction_pct", label: "Online card payments (US)", min: 2.9, unit: "percent", region: "US", conditions: "plus $0.30 fixed" },
      { kind: "transaction_pct", label: "In-person card payments (US)", min: 2.6, unit: "percent", region: "US", conditions: "plus $0.15 fixed" },
    ],
    reserves: [
      { kind: "payout_schedule", summary: "Next-business-day transfers standard; instant transfers available for a fee.", daysMin: 1 },
      { kind: "rolling_reserve", summary: "Square may hold funds or apply reserves based on risk review." },
    ],
    features: { api: "supported", plugins: "supported", pos: "supported", recurring_billing: "supported", invoicing: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: STANDARD_STEPS,
    pros: ["Simple flat pricing", "Free POS and online store tools", "Fast setup"],
    cons: ["Limited country availability", "Not suited to high-risk categories", "Reserve holds can occur on unusual volume"],
    limitations: "Only onboards merchants in a short list of supported countries.",
    sources: [
      { url: "https://squareup.com/us/en/pricing", title: "Square pricing" },
      { url: "https://squareup.com/help/us/en/article/5060", title: "Square prohibited services" },
    ],
  },
  {
    name: "Adyen",
    website: "https://www.adyen.com",
    category: "merchant_account",
    hq: "NL",
    summary: "Enterprise acquirer-processor offering direct acquiring in many markets.",
    suitableFor: "Mid-market and enterprise businesses wanting direct acquiring and interchange++ pricing.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "conditional", MY: "conditional" },
    paymentTypes: ["one_time", "recurring", "marketplace"],
    industries: {
      saas: "supported", ecommerce: "supported", marketplaces: "supported",
      subscriptions: "supported", travel: "conditional", supplements: "unverified",
      forex: "unverified", gaming: "conditional", adult: "prohibited", crypto: "unverified",
      "digital-products": "supported", freelancers: "unverified",
    },
    pricing: [
      { kind: "other", label: "Card processing", region: "Global", conditions: "Interchange++ pricing — a fixed processing fee plus scheme/interchange fees; quote-based" },
    ],
    reserves: [
      { kind: "payout_schedule", summary: "Configurable settlement schedules for enterprise accounts; sales-day payout options documented." },
    ],
    features: { api: "supported", pos: "supported", marketplace_tools: "supported", recurring_billing: "supported" },
    requiredDocs: [...STANDARD_DOCS, "Business financials may be requested for enterprise underwriting"],
    applicationSteps: ["Apply via Adyen website or sales", "Underwriting/KYC review", "Contract and pricing agreement", "Integration and go-live"],
    pros: ["Direct acquiring relationships", "Strong enterprise tooling", "Interchange++ can be cheaper at scale"],
    cons: ["Not aimed at very small businesses", "Pricing is quote-based", "Underwriting heavier than payfac onboarding"],
    sources: [{ url: "https://www.adyen.com/pricing", title: "Adyen pricing" }],
  },
  {
    name: "Checkout.com",
    website: "https://www.checkout.com",
    category: "merchant_account",
    hq: "GB",
    summary: "Global acquiring and payment processing for digital businesses.",
    suitableFor: "Mid-size to enterprise online businesses needing global acquiring.",
    merchantCountries: { US: "supported", GB: "supported", CA: "conditional", AU: "conditional", IN: "conditional", MY: "conditional" },
    paymentTypes: ["one_time", "recurring", "marketplace"],
    industries: {
      saas: "supported", ecommerce: "supported", "digital-products": "supported",
      subscriptions: "supported", marketplaces: "supported", travel: "conditional",
      supplements: "conditional", forex: "conditional", gaming: "conditional",
      adult: "unverified", crypto: "conditional", freelancers: "unverified",
    },
    pricing: [{ kind: "other", label: "Processing fees", conditions: "Tailored pricing; not publicly listed — contact sales" }],
    reserves: [{ kind: "payout_schedule", summary: "Settlement schedules set per contract; typically weekly/daily options for approved merchants." }],
    features: { api: "supported", recurring_billing: "supported", marketplace_tools: "supported" },
    requiredDocs: [...STANDARD_DOCS, "Processing history for established businesses"],
    applicationSteps: ["Contact sales or apply online", "Underwriting review", "Contract and integration"],
    pros: ["Strong global card acquiring", "Serves digital and high-growth businesses"],
    cons: ["Quote-only pricing", "Enterprise-oriented onboarding"],
    sources: [{ url: "https://www.checkout.com", title: "Checkout.com" }],
  },
  {
    name: "Braintree",
    website: "https://www.braintreepayments.com",
    category: "payment_gateway",
    hq: "US",
    summary: "PayPal-owned gateway offering card, PayPal, and wallet acceptance via one integration.",
    suitableFor: "Businesses wanting a gateway with PayPal + cards through one API.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "not_supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring", "marketplace"],
    industries: {
      saas: "supported", ecommerce: "supported", "digital-products": "supported",
      subscriptions: "supported", marketplaces: "conditional", freelancers: "supported",
      travel: "conditional", supplements: "restricted", forex: "prohibited",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [
      { kind: "transaction_pct", label: "Cards & wallets (US)", min: 2.59, unit: "percent", region: "US", conditions: "plus $0.49 per transaction; standard rate" },
    ],
    reserves: [{ kind: "payout_schedule", summary: "Disbursement typically within a few business days depending on underwriting." }],
    features: { api: "supported", recurring_billing: "supported", marketplace_tools: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://www.braintreepayments.com/braintree-pricing", title: "Braintree pricing" }],
  },
  {
    name: "Authorize.Net",
    website: "https://www.authorize.net",
    category: "payment_gateway",
    hq: "US",
    summary: "Long-standing payment gateway; pairs with a merchant account or its all-in-one plan.",
    suitableFor: "Businesses that want a gateway layer over a separate merchant account.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "not_supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", ecommerce: "supported", subscriptions: "supported",
      freelancers: "supported", "digital-products": "supported", marketplaces: "unverified",
      travel: "conditional", supplements: "unverified", forex: "unverified",
      gaming: "unverified", adult: "unverified", crypto: "unverified",
    },
    pricing: [
      { kind: "monthly", label: "Gateway fee", min: 25, currency: "USD", unit: "per_month", region: "US", conditions: "Gateway-only plan" },
      { kind: "transaction_fixed", label: "Per-transaction fee (gateway-only)", min: 0.1, currency: "USD", unit: "per_transaction", region: "US", conditions: "plus daily batch fee; merchant account billed separately" },
      { kind: "transaction_pct", label: "All-in-one plan (US)", min: 2.9, unit: "percent", region: "US", conditions: "plus $0.30; includes merchant account" },
    ],
    features: { api: "supported", recurring_billing: "supported", virtual_terminal: "supported", invoicing: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://www.authorize.net/pricing", title: "Authorize.Net pricing" }],
  },
  {
    name: "Razorpay",
    website: "https://razorpay.com",
    category: "payment_gateway",
    hq: "IN",
    summary: "India-focused payment gateway with cards, UPI, netbanking, and subscriptions.",
    suitableFor: "Businesses registered in India selling domestically or internationally.",
    merchantCountries: { US: "not_supported", GB: "not_supported", CA: "not_supported", AU: "not_supported", IN: "supported", MY: "conditional" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", ecommerce: "supported", "digital-products": "supported",
      subscriptions: "supported", freelancers: "supported", marketplaces: "supported",
      travel: "conditional", supplements: "conditional", forex: "restricted",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [
      { kind: "transaction_pct", label: "Domestic transactions (standard plan)", min: 2, unit: "percent", region: "IN", conditions: "platform fee per transaction on standard plan; international cards higher" },
    ],
    reserves: [{ kind: "payout_schedule", summary: "Standard settlement T+2 business days for most merchants; faster settlement products exist.", daysMin: 2 }],
    features: { api: "supported", plugins: "supported", recurring_billing: "supported", invoicing: "supported" },
    requiredDocs: [...STANDARD_DOCS, "PAN and business KYC documents (India)"],
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://razorpay.com/pricing", title: "Razorpay pricing" }],
  },
  {
    name: "PayU India",
    website: "https://payu.in",
    category: "payment_gateway",
    hq: "IN",
    summary: "Indian payment gateway offering cards, UPI, netbanking, and risk tools.",
    suitableFor: "Indian online businesses needing local payment methods.",
    merchantCountries: { US: "not_supported", GB: "not_supported", CA: "not_supported", AU: "not_supported", IN: "supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", ecommerce: "supported", subscriptions: "supported",
      "digital-products": "supported", freelancers: "supported", marketplaces: "conditional",
      travel: "conditional", supplements: "conditional", forex: "restricted",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Domestic transactions", min: 2, unit: "percent", region: "IN", conditions: "standard plan rate; enterprise pricing custom" }],
    reserves: [{ kind: "payout_schedule", summary: "Settlement typically T+2 business days." }],
    features: { api: "supported", plugins: "supported", recurring_billing: "supported" },
    requiredDocs: [...STANDARD_DOCS, "PAN and business KYC documents (India)"],
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://payu.in/pricing", title: "PayU pricing" }],
  },
  {
    name: "Cashfree Payments",
    website: "https://www.cashfree.com",
    category: "payment_gateway",
    hq: "IN",
    summary: "Indian payment gateway and payouts platform.",
    suitableFor: "Indian businesses needing collections plus bulk payouts.",
    merchantCountries: { US: "not_supported", GB: "not_supported", CA: "not_supported", AU: "not_supported", IN: "supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", ecommerce: "supported", subscriptions: "supported",
      "digital-products": "supported", freelancers: "supported", marketplaces: "supported",
      travel: "conditional", supplements: "conditional", forex: "restricted",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Domestic transactions (from)", min: 1.9, unit: "percent", region: "IN", conditions: "starting rate; varies by payment method" }],
    reserves: [{ kind: "payout_schedule", summary: "Standard settlement around T+1 to T+2 business days.", daysMin: 1, daysMax: 2 }],
    features: { api: "supported", plugins: "supported", recurring_billing: "supported" },
    requiredDocs: [...STANDARD_DOCS, "PAN and business KYC documents (India)"],
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://www.cashfree.com/pricing", title: "Cashfree pricing" }],
  },
  {
    name: "CCAvenue",
    website: "https://www.ccavenue.com",
    category: "payment_gateway",
    hq: "IN",
    summary: "Established Indian payment gateway with broad payment-method coverage.",
    suitableFor: "Indian merchants wanting a long-established gateway with many local methods.",
    merchantCountries: { US: "not_supported", GB: "not_supported", CA: "not_supported", AU: "not_supported", IN: "supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", ecommerce: "supported", subscriptions: "supported",
      freelancers: "supported", "digital-products": "supported", marketplaces: "unverified",
      travel: "conditional", supplements: "conditional", forex: "restricted",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Startup plan", min: 2, unit: "percent", region: "IN", conditions: "per-transaction fee on published startup plan" }],
    features: { api: "supported", plugins: "supported", recurring_billing: "supported" },
    requiredDocs: [...STANDARD_DOCS, "PAN and business KYC documents (India)"],
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://www.ccavenue.com/fees", title: "CCAvenue fees" }],
  },
  {
    name: "Instamojo",
    website: "https://www.instamojo.com",
    category: "payment_gateway",
    hq: "IN",
    summary: "Indian payment gateway aimed at small businesses, creators, and freelancers.",
    suitableFor: "Indian micro/small businesses, solopreneurs, and digital sellers.",
    merchantCountries: { US: "not_supported", GB: "not_supported", CA: "not_supported", AU: "not_supported", IN: "supported", MY: "not_supported" },
    paymentTypes: ["one_time"],
    industries: {
      ecommerce: "supported", "digital-products": "supported", freelancers: "supported",
      saas: "supported", subscriptions: "conditional", marketplaces: "unverified",
      travel: "unverified", supplements: "unverified", forex: "prohibited",
      gaming: "unverified", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Per-transaction fee", min: 2, unit: "percent", region: "IN", conditions: "plus small fixed fee per transaction; check current plan" }],
    features: { plugins: "supported", hosted_checkout: "supported", invoicing: "supported" },
    requiredDocs: [...STANDARD_DOCS, "PAN and business KYC documents (India)"],
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://www.instamojo.com/pricing", title: "Instamojo pricing" }],
  },
  {
    name: "Mollie",
    website: "https://www.mollie.com",
    category: "payment_processor",
    hq: "NL",
    summary: "European-focused processor with simple per-transaction pricing.",
    suitableFor: "European businesses wanting simple onboarding and local payment methods.",
    merchantCountries: { US: "not_supported", GB: "supported", CA: "not_supported", AU: "not_supported", IN: "not_supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", ecommerce: "supported", subscriptions: "supported",
      freelancers: "supported", "digital-products": "supported", marketplaces: "conditional",
      travel: "conditional", supplements: "unverified", forex: "prohibited",
      gaming: "unverified", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [
      { kind: "transaction_pct", label: "Consumer cards (EU/EEA)", min: 1.8, unit: "percent", region: "EU", conditions: "plus €0.25 per transaction" },
      { kind: "transaction_fixed", label: "Fixed per transaction", min: 0.25, currency: "EUR", unit: "fixed", region: "EU" },
    ],
    features: { api: "supported", plugins: "supported", recurring_billing: "supported" },
    requiredDocs: [...STANDARD_DOCS, "European business registration (EEA/UK/CH entity required)"],
    applicationSteps: STANDARD_STEPS,
    limitations: "Requires a registered business in the EEA, UK, or Switzerland.",
    sources: [{ url: "https://www.mollie.com/pricing", title: "Mollie pricing" }],
  },
  {
    name: "Paystack",
    website: "https://paystack.com",
    category: "payment_gateway",
    hq: "NG",
    summary: "African payments platform (Stripe-owned) serving Nigeria, Ghana, South Africa and others.",
    suitableFor: "Businesses registered in Paystack's supported African markets.",
    merchantCountries: { US: "not_supported", GB: "not_supported", CA: "not_supported", AU: "not_supported", IN: "not_supported", MY: "not_supported", NG: "supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", ecommerce: "supported", "digital-products": "supported",
      subscriptions: "supported", freelancers: "supported", marketplaces: "supported",
      travel: "conditional", supplements: "conditional", forex: "restricted",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Local transactions (Nigeria)", min: 1.5, unit: "percent", region: "NG", conditions: "plus NGN 100 (waived for transactions under ₦2,500)" }],
    features: { api: "supported", plugins: "supported", recurring_billing: "supported", marketplace_tools: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://paystack.com/pricing", title: "Paystack pricing" }],
  },
  {
    name: "Flutterwave",
    website: "https://flutterwave.com",
    category: "payment_gateway",
    hq: "NG",
    summary: "African payments infrastructure company covering many countries and payment methods.",
    suitableFor: "Businesses selling into or operating from supported African markets.",
    merchantCountries: { US: "not_supported", GB: "conditional", CA: "not_supported", AU: "not_supported", IN: "not_supported", MY: "not_supported", NG: "supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", ecommerce: "supported", "digital-products": "supported",
      subscriptions: "supported", freelancers: "supported", marketplaces: "conditional",
      travel: "conditional", supplements: "unverified", forex: "restricted",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Local transactions (Nigeria)", min: 1.4, unit: "percent", region: "NG", conditions: "plus applicable fixed fees; varies by method" }],
    features: { api: "supported", plugins: "supported", recurring_billing: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://flutterwave.com/pricing", title: "Flutterwave pricing" }],
  },
  {
    name: "Paddle",
    website: "https://www.paddle.com",
    category: "mor",
    hq: "GB",
    summary: "Merchant of Record for SaaS and digital products — handles tax, compliance, and billing.",
    suitableFor: "Software and digital-product companies wanting to outsource tax/compliance via Merchant of Record.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "conditional", MY: "conditional" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", "digital-products": "supported", subscriptions: "supported",
      ecommerce: "unverified", freelancers: "unverified", marketplaces: "prohibited",
      travel: "prohibited", supplements: "prohibited", forex: "prohibited",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Standard fee", min: 5, unit: "percent", conditions: "plus $0.50 per transaction; includes MoR services (tax, fraud, compliance)" }],
    reserves: [{ kind: "payout_schedule", summary: "Payouts on a regular scheduled cadence to your payout method; schedule documented in Paddle docs." }],
    features: { api: "supported", hosted_checkout: "supported", recurring_billing: "supported", invoicing: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: ["Create a Paddle account", "Submit product catalog for approval", "Domain/business verification", "Integrate checkout or billing"],
    pros: ["MoR handles global sales tax/VAT", "Good fit for SaaS and digital goods"],
    cons: ["Higher headline fee than raw processing", "Product approval required", "Limited to digital-focused categories"],
    sources: [{ url: "https://www.paddle.com/pricing", title: "Paddle pricing" }],
  },
  {
    name: "Lemon Squeezy",
    website: "https://www.lemonsqueezy.com",
    category: "mor",
    hq: "US",
    summary: "Merchant of Record for digital products, software, and subscriptions (acquired by Stripe).",
    suitableFor: "Indie hackers and digital-product sellers wanting MoR simplicity.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "conditional", MY: "conditional" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", "digital-products": "supported", subscriptions: "supported",
      ecommerce: "conditional", freelancers: "conditional", marketplaces: "prohibited",
      travel: "prohibited", supplements: "prohibited", forex: "prohibited",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Standard fee", min: 5, unit: "percent", conditions: "plus $0.50 per transaction; includes MoR services" }],
    features: { api: "supported", hosted_checkout: "supported", recurring_billing: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: ["Create an account", "Add products", "Store/verification review", "Publish checkout"],
    sources: [{ url: "https://www.lemonsqueezy.com/pricing", title: "Lemon Squeezy pricing" }],
  },
  {
    name: "2Checkout (Verifone)",
    website: "https://verifone.cloud",
    category: "mor",
    hq: "US",
    summary: "Verifone's online payments platform offering MoR-style selling in many countries.",
    suitableFor: "Digital goods and SaaS sellers needing wide country coverage through a MoR.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "conditional", MY: "conditional" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      saas: "supported", "digital-products": "supported", subscriptions: "supported",
      ecommerce: "supported", freelancers: "conditional", marketplaces: "unverified",
      travel: "conditional", supplements: "conditional", forex: "prohibited",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "2Sell plan", min: 3.5, unit: "percent", conditions: "plus $0.35 per transaction; higher tiers for subscription/MoR features" }],
    features: { api: "supported", hosted_checkout: "supported", recurring_billing: "supported", plugins: "supported" },
    requiredDocs: STANDARD_DOCS,
    applicationSteps: STANDARD_STEPS,
    sources: [{ url: "https://verifone.cloud/docs/2checkout", title: "2Checkout documentation" }],
  },
  {
    name: "dLocal",
    website: "https://dlocal.com",
    category: "payment_processor",
    hq: "UY",
    summary: "Cross-border processor specializing in emerging-market payment methods.",
    suitableFor: "Global merchants wanting to accept local payment methods in emerging markets.",
    merchantCountries: { US: "conditional", GB: "conditional", CA: "conditional", AU: "conditional", IN: "conditional", MY: "conditional" },
    paymentTypes: ["one_time", "marketplace"],
    industries: {
      saas: "supported", ecommerce: "supported", travel: "conditional",
      "digital-products": "supported", subscriptions: "conditional", marketplaces: "supported",
      freelancers: "unverified", supplements: "unverified", forex: "conditional",
      gaming: "conditional", adult: "unverified", crypto: "unverified",
    },
    pricing: [{ kind: "other", label: "Processing fees", conditions: "Custom pricing by market; not publicly listed" }],
    features: { api: "supported", marketplace_tools: "supported" },
    applicationSteps: ["Contact sales", "Underwriting and market scoping", "Contract", "API integration"],
    sources: [{ url: "https://dlocal.com", title: "dLocal" }],
  },
  {
    name: "Worldpay",
    website: "https://www.worldpay.com",
    category: "merchant_account",
    hq: "GB",
    summary: "Large global acquirer and merchant account provider (FIS/FISERV spin).",
    suitableFor: "Mid-size to enterprise merchants wanting direct acquiring and omnichannel.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "conditional", MY: "conditional" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      ecommerce: "supported", saas: "supported", subscriptions: "supported",
      travel: "conditional", marketplaces: "conditional", "digital-products": "supported",
      freelancers: "unverified", supplements: "unverified", forex: "unverified",
      gaming: "conditional", adult: "unverified", crypto: "unverified",
    },
    pricing: [{ kind: "other", label: "Processing fees", conditions: "Quote-based; interchange++ and blended options by contract" }],
    features: { api: "supported", pos: "supported", recurring_billing: "supported" },
    applicationSteps: ["Request a quote", "Underwriting", "Contract", "Integration"],
    sources: [{ url: "https://www.worldpay.com", title: "Worldpay" }],
  },
  {
    name: "Nuvei",
    website: "https://nuvei.com",
    category: "merchant_account",
    hq: "CA",
    summary: "Global acquirer with strong coverage of regulated and higher-risk verticals.",
    suitableFor: "Merchants in regulated verticals needing a direct acquirer relationship.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "conditional", IN: "conditional", MY: "conditional" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      ecommerce: "supported", saas: "supported", gaming: "conditional",
      forex: "conditional", travel: "conditional", crypto: "conditional",
      supplements: "conditional", subscriptions: "supported", "digital-products": "supported",
      marketplaces: "conditional", adult: "unverified", freelancers: "unverified",
    },
    pricing: [{ kind: "other", label: "Processing fees", conditions: "Quote-based" }],
    features: { api: "supported", recurring_billing: "supported", marketplace_tools: "conditional" },
    applicationSteps: ["Contact sales", "Underwriting", "Contract", "Integration"],
    sources: [{ url: "https://nuvei.com", title: "Nuvei" }],
  },
  {
    name: "PaymentCloud",
    website: "https://paymentcloudinc.com",
    category: "high_risk",
    hq: "US",
    summary: "US high-risk merchant account broker placing hard-to-approve businesses with acquiring partners.",
    suitableFor: "US businesses in high-risk categories declined by mainstream providers.",
    merchantCountries: { US: "supported", GB: "unverified", CA: "unverified", AU: "unverified", IN: "not_supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      supplements: "conditional", adult: "conditional", forex: "conditional",
      travel: "conditional", gaming: "conditional", ecommerce: "supported",
      saas: "supported", subscriptions: "conditional", "digital-products": "conditional",
      marketplaces: "unverified", freelancers: "unverified", crypto: "conditional",
    },
    pricing: [{ kind: "other", label: "Processing fees", conditions: "Quote-based through acquiring partners; depends on risk profile" }],
    reserves: [{ kind: "rolling_reserve", summary: "Rolling reserves are common for high-risk placements; percentage and period set by the acquiring bank." }],
    requiredDocs: [...STANDARD_DOCS, "Processing statements", "Bank statements (typically 3 months)"],
    applicationSteps: ["Submit application", "Matched with acquiring partner", "Underwriting", "Approval and gateway setup"],
    sources: [{ url: "https://paymentcloudinc.com", title: "PaymentCloud" }],
  },
  {
    name: "Durango Merchant Services",
    website: "https://www.durango-direct.com",
    category: "high_risk",
    hq: "US",
    summary: "High-risk merchant account provider with US and offshore acquiring options.",
    suitableFor: "High-risk and hard-to-place merchants, including those needing offshore acquiring.",
    merchantCountries: { US: "supported", GB: "conditional", CA: "conditional", AU: "unverified", IN: "unverified", MY: "unverified" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      supplements: "conditional", adult: "conditional", forex: "conditional",
      travel: "conditional", gaming: "conditional", crypto: "conditional",
      ecommerce: "supported", saas: "conditional", subscriptions: "conditional",
      "digital-products": "conditional", marketplaces: "unverified", freelancers: "unverified",
    },
    pricing: [{ kind: "other", label: "Processing fees", conditions: "Quote-based" }],
    reserves: [{ kind: "rolling_reserve", summary: "Rolling reserves common; terms depend on acquiring partner and risk." }],
    applicationSteps: ["Apply online", "Documentation review", "Acquiring match", "Underwriting decision"],
    sources: [{ url: "https://www.durango-direct.com", title: "Durango Merchant Services" }],
  },
  {
    name: "Soar Payments",
    website: "https://soarpayments.com",
    category: "high_risk",
    hq: "US",
    summary: "US merchant account provider specializing in high-risk and hard-to-place industries.",
    suitableFor: "US high-risk businesses needing dedicated merchant accounts.",
    merchantCountries: { US: "supported", GB: "unverified", CA: "unverified", AU: "unverified", IN: "not_supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      supplements: "conditional", adult: "conditional", travel: "conditional",
      gaming: "conditional", forex: "conditional", crypto: "conditional",
      ecommerce: "supported", saas: "supported", subscriptions: "conditional",
      "digital-products": "conditional", marketplaces: "unverified", freelancers: "unverified",
    },
    pricing: [{ kind: "other", label: "Processing fees", conditions: "Quote-based; published minimum pricing on site" }],
    applicationSteps: ["Apply online", "Underwriting with partner banks", "Approval", "Gateway/terminal setup"],
    sources: [{ url: "https://soarpayments.com", title: "Soar Payments" }],
  },
  {
    name: "Shopify Payments",
    website: "https://www.shopify.com/payments",
    category: "payfac",
    hq: "CA",
    summary: "Stripe-powered payments built into Shopify; removes third-party transaction fees on Shopify plans.",
    suitableFor: "Merchants already selling on Shopify in supported countries.",
    merchantCountries: { US: "conditional", GB: "conditional", CA: "conditional", AU: "conditional", IN: "not_supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      ecommerce: "supported", "digital-products": "supported", subscriptions: "supported",
      saas: "conditional", freelancers: "conditional", marketplaces: "unverified",
      travel: "restricted", supplements: "restricted", forex: "prohibited",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Online cards (US Basic)", min: 2.9, unit: "percent", region: "US", conditions: "plus $0.30 on Basic plan; lower on higher plans" }],
    features: { plugins: "supported", recurring_billing: "supported", pos: "supported" },
    limitations: "Only available to Shopify merchants in supported countries; requires an active Shopify plan.",
    sources: [{ url: "https://www.shopify.com/pricing", title: "Shopify pricing" }],
  },
  {
    name: "Amazon Pay",
    website: "https://pay.amazon.com",
    category: "payment_gateway",
    hq: "US",
    summary: "Checkout wallet letting customers pay with their Amazon account.",
    suitableFor: "Ecommerce merchants wanting an express wallet option for Amazon customers.",
    merchantCountries: { US: "supported", GB: "supported", CA: "not_supported", AU: "not_supported", IN: "supported", MY: "not_supported" },
    paymentTypes: ["one_time", "recurring"],
    industries: {
      ecommerce: "supported", "digital-products": "supported", subscriptions: "conditional",
      saas: "unverified", freelancers: "unverified", marketplaces: "unverified",
      travel: "conditional", supplements: "conditional", forex: "prohibited",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "transaction_pct", label: "Web transactions (US)", min: 2.9, unit: "percent", region: "US", conditions: "plus $0.30 authorization fee" }],
    features: { plugins: "supported", hosted_checkout: "supported" },
    sources: [{ url: "https://pay.amazon.com/business/fees", title: "Amazon Pay fees" }],
  },
  {
    name: "Klarna",
    website: "https://www.klarna.com/business",
    category: "payment_processor",
    hq: "SE",
    summary: "BNPL provider offering pay-later options alongside card acceptance.",
    suitableFor: "Merchants wanting buy-now-pay-later conversion lift in supported markets.",
    merchantCountries: { US: "supported", GB: "supported", CA: "conditional", AU: "supported", IN: "not_supported", MY: "not_supported" },
    paymentTypes: ["one_time"],
    industries: {
      ecommerce: "supported", travel: "conditional", subscriptions: "unverified",
      saas: "unverified", "digital-products": "unverified", freelancers: "unverified",
      marketplaces: "conditional", supplements: "restricted", forex: "prohibited",
      gaming: "conditional", adult: "prohibited", crypto: "prohibited",
    },
    pricing: [{ kind: "other", label: "Processing fees", conditions: "Varies by product (Pay now / Pay later / Financing) and market; see merchant terms" }],
    features: { plugins: "supported", hosted_checkout: "supported" },
    sources: [{ url: "https://www.klarna.com/business", title: "Klarna for business" }],
  },

  // ---- Business formation -------------------------------------------------
  {
    name: "Stripe Atlas",
    website: "https://stripe.com/atlas",
    category: "formation",
    hq: "US",
    summary: "Delaware company formation (C-corp or LLC) for global founders, from Stripe.",
    suitableFor: "Founders worldwide who need a US entity to access US banking and payments.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "supported", MY: "supported" },
    pricing: [{ kind: "setup", label: "Formation package", min: 500, currency: "USD", unit: "fixed", conditions: "one-time; registered agent and state fees separate" }],
    requiredDocs: ["Founder identity documents", "Company details and ownership info"],
    applicationSteps: ["Apply on Stripe Atlas", "Provide founder/company info", "Entity filed in Delaware", "Receive documents and EIN application support"],
    pros: ["Built-in path to a Stripe account", "Fast Delaware formation"],
    cons: ["Delaware-only", "Ongoing registered agent costs"],
    sources: [{ url: "https://stripe.com/atlas", title: "Stripe Atlas" }],
  },
  {
    name: "Firstbase",
    website: "https://www.firstbase.io",
    category: "formation",
    hq: "US",
    summary: "Company formation and compliance platform for global founders.",
    suitableFor: "Non-US founders forming US entities with banking/mail add-ons.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "supported", MY: "supported" },
    pricing: [{ kind: "setup", label: "Formation package", min: 399, currency: "USD", unit: "fixed", conditions: "one-time; add-ons priced separately" }],
    applicationSteps: ["Choose entity type", "Submit founder info", "Formation filing", "EIN and add-on services"],
    sources: [{ url: "https://www.firstbase.io", title: "Firstbase" }],
  },
  {
    name: "doola",
    website: "https://www.doola.com",
    category: "formation",
    hq: "US",
    summary: "US LLC/C-corp formation with bookkeeping and compliance add-ons for global founders.",
    suitableFor: "Founders wanting a US LLC plus ongoing bookkeeping/compliance.",
    merchantCountries: { US: "supported", GB: "supported", CA: "supported", AU: "supported", IN: "supported", MY: "supported" },
    pricing: [{ kind: "other", label: "Formation packages", conditions: "Tiered packages from a few hundred USD/yr plus state fees — verify current tiers" }],
    applicationSteps: ["Pick package", "Submit info", "Formation + EIN", "Optional bookkeeping/compliance"],
    sources: [{ url: "https://www.doola.com", title: "doola" }],
  },
  {
    name: "Clerky",
    website: "https://www.clerky.com",
    category: "formation",
    hq: "US",
    summary: "Legal formation service used heavily by startups for Delaware incorporations.",
    suitableFor: "Startups forming Delaware C-corps with clean legal paperwork.",
    merchantCountries: { US: "supported", GB: "conditional", CA: "conditional", AU: "conditional", IN: "conditional", MY: "conditional" },
    pricing: [{ kind: "other", label: "Formation package", conditions: "Per-package pricing on site" }],
    applicationSteps: ["Start formation flow", "Company info", "Delaware filing", "Post-formation documents"],
    sources: [{ url: "https://www.clerky.com", title: "Clerky" }],
  },
  {
    name: "Northwest Registered Agent",
    website: "https://www.northwestregisteredagent.com",
    category: "formation",
    hq: "US",
    summary: "Registered agent and LLC/corporation formation in every US state.",
    suitableFor: "US residents and non-residents wanting low-cost state formation plus registered agent.",
    merchantCountries: { US: "supported", GB: "conditional", CA: "conditional", AU: "conditional", IN: "conditional", MY: "conditional" },
    pricing: [{ kind: "setup", label: "LLC formation", min: 39, currency: "USD", unit: "fixed", conditions: "plus state fees; includes first-year registered agent" }],
    applicationSteps: ["Choose state", "Place order", "Filing + registered agent", "Documents delivered"],
    sources: [{ url: "https://www.northwestregisteredagent.com", title: "Northwest Registered Agent" }],
  },
  {
    name: "Bizee",
    website: "https://www.bizee.com",
    category: "formation",
    hq: "US",
    summary: "Low-cost US LLC formation (formerly Incfile) with a free basic tier.",
    suitableFor: "Budget-conscious founders forming US LLCs.",
    merchantCountries: { US: "supported", GB: "conditional", CA: "conditional", AU: "conditional", IN: "conditional", MY: "conditional" },
    pricing: [{ kind: "setup", label: "Basic formation", min: 0, currency: "USD", unit: "fixed", conditions: "$0 + state fees for basic package; paid tiers add features" }],
    applicationSteps: ["Choose package", "Provide info", "State filing", "Documents + optional registered agent"],
    sources: [{ url: "https://www.bizee.com", title: "Bizee" }],
  },
];

// ---------------------------------------------------------------------------
// Seed execution
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding countries…");
  for (const c of COUNTRIES) {
    await db.country.upsert({
      where: { code: c.code },
      create: { code: c.code, name: c.name, region: c.region, intro: c.intro },
      update: { name: c.name, region: c.region, intro: c.intro },
    });
  }

  console.log("Seeding industries…");
  for (const i of INDUSTRIES) {
    await db.industry.upsert({
      where: { slug: i.slug },
      create: { slug: i.slug, name: i.name, riskLevel: i.risk, summary: i.summary },
      update: { name: i.name, riskLevel: i.risk, summary: i.summary },
    });
  }
  const industries = await db.industry.findMany();
  const indBySlug = new Map(industries.map((i) => [i.slug, i.id]));

  console.log(`Seeding ${PROVIDERS.length} providers…`);
  for (const p of PROVIDERS) {
    const slug = slugify(p.name);
    const provider = await db.provider.upsert({
      where: { slug },
      create: {
        slug,
        name: p.name,
        normalizedName: normalizeProviderName(p.name),
        websiteUrl: p.website,
        domain: hostname(p.website),
        category: p.category,
        hqCountryCode: p.hq,
        summary: p.summary,
        suitableFor: p.suitableFor,
        status: p.status ?? "published",
        paymentTypes: p.paymentTypes ?? [],
        requiredDocs: p.requiredDocs ?? [],
        applicationSteps: p.applicationSteps ?? [],
        pros: p.pros ?? [],
        cons: p.cons ?? [],
        limitations: p.limitations,
        registrationRequirement: p.registration,
        ownerResidency: p.ownerResidency,
      },
      update: {
        name: p.name,
        websiteUrl: p.website,
        domain: hostname(p.website),
        category: p.category,
        summary: p.summary,
        suitableFor: p.suitableFor,
        status: p.status ?? "published",
        paymentTypes: p.paymentTypes ?? [],
        requiredDocs: p.requiredDocs ?? [],
        applicationSteps: p.applicationSteps ?? [],
        pros: p.pros ?? [],
        cons: p.cons ?? [],
        limitations: p.limitations,
        registrationRequirement: p.registration,
      },
    });

    // Country eligibility
    for (const [code, status] of Object.entries(p.merchantCountries)) {
      await db.providerCountryEligibility.upsert({
        where: {
          providerId_countryCode_scope: {
            providerId: provider.id,
            countryCode: code,
            scope: "merchant_apply",
          },
        },
        create: { providerId: provider.id, countryCode: code, scope: "merchant_apply", status },
        update: { status },
      });
    }

    // Industries
    if (p.industries) {
      for (const [indSlug, status] of Object.entries(p.industries)) {
        const industryId = indBySlug.get(indSlug);
        if (!industryId) continue;
        await db.providerIndustry.upsert({
          where: {
            providerId_industryId: { providerId: provider.id, industryId },
          },
          create: {
            providerId: provider.id,
            industryId,
            status,
            notes: p.industryNotes?.[indSlug],
          },
          update: { status, notes: p.industryNotes?.[indSlug] },
        });
      }
    }

    // Pricing — replace seeded rows
    await db.pricingTerm.deleteMany({ where: { providerId: provider.id } });
    for (const t of p.pricing ?? []) {
      await db.pricingTerm.create({
        data: {
          providerId: provider.id,
          kind: t.kind,
          label: t.label,
          amountMin: t.min,
          amountMax: t.max,
          currency: t.currency,
          unit: t.unit,
          region: t.region,
          conditions: t.conditions,
        },
      });
    }

    // Reserves/payouts
    await db.reservePayoutTerm.deleteMany({ where: { providerId: provider.id } });
    for (const r of p.reserves ?? []) {
      await db.reservePayoutTerm.create({
        data: {
          providerId: provider.id,
          kind: r.kind,
          summary: r.summary,
          percent: r.percent,
          daysMin: r.daysMin,
          daysMax: r.daysMax,
          conditions: r.conditions,
        },
      });
    }

    // Features
    for (const [key, status] of Object.entries(p.features ?? {})) {
      await db.providerFeature.upsert({
        where: { providerId_key: { providerId: provider.id, key } },
        create: { providerId: provider.id, key, status },
        update: { status },
      });
    }

    // Official sources + a seed evidence record (unverified until pipeline runs)
    for (const s of p.sources ?? []) {
      const source = await db.source.upsert({
        where: { url: s.url },
        create: {
          url: s.url,
          host: hostname(s.url),
          title: s.title,
          sourceType: "official",
          providerId: provider.id,
        },
        update: { title: s.title, providerId: provider.id },
      });
      const hasEvidence = await db.evidence.findFirst({
        where: { providerId: provider.id, sourceId: source.id, field: "seed.record" },
      });
      if (!hasEvidence) {
        await db.evidence.create({
          data: {
            providerId: provider.id,
            sourceId: source.id,
            field: "seed.record",
            claim: `Seeded directory record for ${p.name}; fields pending automated verification.`,
            status: "unverified",
            extractionMethod: "seed",
            confidence: 0.3,
          },
        });
      }
    }
  }

  const counts = {
    countries: await db.country.count(),
    industries: await db.industry.count(),
    providers: await db.provider.count(),
    sources: await db.source.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
