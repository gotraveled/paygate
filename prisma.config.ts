import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

// `env()` throws on missing vars — but `prisma generate` (which runs on
// every `npm install`, including Vercel builds) doesn't need a live
// datasource. Fall back to the local dev db when DATABASE_URL is unset;
// also scan env values so prefixed vars (e.g. STORAGE_POSTGRES_URL)
// still resolve to the postgres datasource.
const url =
  process.env.DATABASE_URL ||
  Object.values(process.env).find(
    (v): v is string =>
      typeof v === "string" && /^postgres(ql)?:\/\//.test(v)
  ) ||
  "file:./prisma/dev.db";
const isPg = /^postgres(ql)?:\/\//.test(url);

// The generated client's datasource provider must match the driver
// adapter used at runtime: sqlite locally, postgres in production.
// When targeting postgres, emit a provider-swapped schema so
// `prisma generate` and `prisma db push` produce a compatible client.
const SRC = "prisma/schema.prisma";
const PG = "prisma/schema.pg.prisma";
let schema = SRC;
if (isPg) {
  const src = readFileSync(SRC, "utf8");
  const pg = src.replace(
    /datasource db \{\s*provider = "sqlite"\s*\}/,
    'datasource db {\n  provider = "postgresql"\n}'
  );
  if (pg === src) throw new Error("sqlite datasource block not found");
  writeFileSync(PG, pg);
  schema = PG;
}

export default defineConfig({
  schema,
  datasource: {
    url,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
