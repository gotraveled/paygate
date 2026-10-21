# PayGate — Global Financial Services Directory

An informational directory of payment gateways, payment processors, merchant
account providers, and business formation services — maintained by an
automated research pipeline that discovers providers, collects evidence from
official sources, detects changes, and drafts content.

## Stack

- **Next.js 16** (App Router, Cache Components) + **TypeScript**
- **Tailwind CSS 4** + hand-rolled shadcn-style components
- **Prisma 7** (driver adapters) — **SQLite** locally, **PostgreSQL/Supabase** in production
- **Vitest** for unit tests, **tsx** for scripts

## Quick start (local)

```bash
cp .env.example .env          # defaults to SQLite at prisma/dev.db
npm install                   # postinstall runs `prisma generate`
npm run db:push               # create schema in dev.db
npm run db:seed               # seed countries, industries, ~33 providers
npm run dev
```

Open http://localhost:3000.

## Project layout

```
src/app/            public pages, sitemap, robots, /out affiliate redirect, /api/cron
src/components/     UI + domain components (ProviderCard, filters, badges)
src/lib/            db client, queries, seo, eligibility, markdown
src/lib/research/   the research pipeline (below)
prisma/             schema.prisma (single source of truth) + seed.ts
scripts/            run-job.ts (CLI), prepare-pg.mjs (Postgres push)
tests/              vitest unit tests
```

## The research pipeline

Five coordinated agents backed by a durable job queue (`ResearchJob` /
`JobLog` tables — no external worker needed):

| Agent | Job type | What it does |
|-------|----------|--------------|
| A — Discovery | `discover` | Finds new providers from seeds/crawl lists, dedupes by normalized name + domain |
| B — Research | `research` | Fetches official pages, extracts pricing/country/policy signals into `Evidence` + `Source` rows |
| C — Verify | `verify` | Re-fetches sources, diffs content, records `ChangeEvent`s, flags broken links; significant changes → `ReviewItem` |
| D — Content | `content` | Generates provider guide drafts from verified data; validates quality before `review`/`published` |
| E — Affiliates | `affiliates` | Finds official affiliate/partner programs; flags ones needing your action |
| — | `report` | Daily markdown + JSON report in `Report` table |

### Run jobs locally

```bash
npm run jobs -- research '{"providerId":"<id>"}'   # research one provider
npm run jobs -- verify '{}'                        # re-check stale sources
npm run jobs -- affiliates '{}'                    # scan for affiliate programs
npm run jobs -- content '{"providerId":"<id>"}'    # draft a provider guide
npm run jobs -- report '{}'                        # daily report
npm run jobs:daily                                 # full daily pipeline
npm run jobs -- drain                              # process the pending queue
```

Fetching is polite: per-host rate limit, `robots.txt` checks, honest
User-Agent, timeouts. Set `RESEARCH_*` env vars to tune.

### Scheduled runs (Vercel)

`vercel.json` registers two crons hitting `/api/cron`:

- `0 6 * * *` → full daily pipeline
- `*/30 * * * *` → drain the pending job queue

The route requires `Authorization: Bearer <CRON_SECRET>`. Vercel cron sends
this automatically when `CRON_SECRET` is set.

## Data integrity rules

- Every factual claim lives in `Evidence` with a `Source`, retrieval date,
  and status: `supported | not_supported | conditional | undisclosed |
  conflicting | unverified | outdated`.
- Seeded data starts **unverified** — the verify job upgrades it when it
  confirms official sources. Nothing unverified is presented as fact.
- Missing data is never treated as approval or rejection.
- Merchant country, customer geography, and settlement are separate scopes.
- Failed fetches never erase stored facts — sources get flagged `active=false`
  and a `ReviewItem` is opened instead.
- Affiliate links are only emitted through `/out/<slug>` when
  `provider.affiliateUrl` exists — which is only set after a partnership is
  **approved**. All such links carry disclosure + `rel="nofollow"`.

## Production deploy (Vercel + Supabase)

1. Create a Supabase project; copy the pooled Postgres URL.
2. Push the schema to Postgres (uses the same Prisma schema, provider-swapped):

   ```bash
   DATABASE_URL="postgresql://postgres:<pw>@<host>:5432/postgres" npm run db:push:pg
   ```

3. Import the repo to Vercel and set env vars:
   - `DATABASE_URL` — Postgres URL
   - `NEXT_PUBLIC_SITE_URL` — e.g. `https://paygate.example.com`
   - `CRON_SECRET` — long random string
   - `NEXT_PUBLIC_CONTACT_EMAIL`
   - optional `NOTIFY_WEBHOOK_URL` (Slack/Discord webhook for failure alerts)
4. Seed production data once: `DATABASE_URL=<pg> npx tsx prisma/seed.ts`
5. Vercel Cron picks up `/api/cron` automatically from `vercel.json`.

## Operations

- **Review queue** — `ReviewItem` rows hold ambiguous dedup hits, significant
  changes, failed content validations, and affiliate programs needing your
  action. Nothing significant publishes itself.
- **Change history** — `ChangeEvent` rows keep old→new values forever so
  outdated claims are traceable.
- **Daily report** — latest in `Report` table or run `npm run jobs -- report`.

## Verifying the build

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run build       # production build
```

## Roadmap

- Stage 7: seed/verify the first 100 provider records via the research agents
- Add `credit_cards` + `insurance` verticals (schema already has `vertical`)
- Expand `config`-driven discovery sources for Agent A
- Review-queue admin page (read/resolve `ReviewItem`s) — intentionally minimal
