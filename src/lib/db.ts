import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 uses driver adapters. Select the adapter from DATABASE_URL:
 *   file:...        -> better-sqlite3 (local development)
 *   postgres://...  -> pg driver adapter (Supabase / production)
 */
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    const adapter = new PrismaBetterSqlite3({ url: filePath });
    return new PrismaClient({ adapter });
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
