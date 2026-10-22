import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 uses driver adapters. Select the adapter from the connection URL:
 *   file:...                  -> better-sqlite3 (local development)
 *   postgres://...            -> pg driver adapter (Supabase / direct Postgres)
 *   prisma+postgres://...     -> Prisma Postgres / Accelerate (Vercel integration)
 *
 * Vercel's database integrations can expose the connection under several
 * env var names — check them all rather than assuming DATABASE_URL.
 */
const NAMED_URL_VARS = [
  "DATABASE_URL",
  "PRISMA_DATABASE_URL",
  "PRISMA_POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
] as const;

const isPrismaUrl = (u: string) =>
  u.startsWith("prisma://") || u.startsWith("prisma+postgres://");

function resolveUrl(): string {
  const named = NAMED_URL_VARS.map((k) => process.env[k]).filter(
    (u): u is string => Boolean(u)
  );
  // Vercel integrations let you set a custom env-var prefix (e.g.
  // STORAGE_DATABASE_URL) — fixed names alone can miss the connection,
  // so also scan every env value by URL scheme.
  const all = [
    ...named,
    ...Object.values(process.env).filter((u): u is string => Boolean(u)),
  ];
  // Prefer prisma+postgres:// (Accelerate): the generated client is
  // compiled for provider "sqlite", so a driver adapter like pg is
  // rejected at construction — only the accelerateUrl path works with
  // a remote database without regenerating for postgresql.
  return (
    all.find(isPrismaUrl) ??
    named.find((u) => u.startsWith("file:")) ??
    all.find((u) => /^postgres(ql)?:\/\//.test(u)) ??
    "file:./prisma/dev.db"
  );
}

function createClient(): PrismaClient {
  const url = resolveUrl();
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    const adapter = new PrismaBetterSqlite3({ url: filePath });
    return new PrismaClient({ adapter });
  }
  // Prisma Postgres / Accelerate URLs (what Vercel's Prisma integration
  // provisions) use the prisma+postgres:// or prisma:// scheme — the pg
  // driver adapter can't speak that protocol.
  if (url.startsWith("prisma://") || url.startsWith("prisma+postgres://")) {
    return new PrismaClient({ accelerateUrl: url });
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  return (globalForPrisma.prisma ??= createClient());
}

/**
 * Lazy proxy: `next build` evaluates route modules while collecting page
 * data, and constructing PrismaClient at module scope makes the build
 * fail when the adapter can't initialize in the build environment.
 * Defer construction to the first actual use at request time.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
