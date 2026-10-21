/**
 * Generates the PostgreSQL variant of the Prisma schema and pushes it to
 * the database in DATABASE_URL (e.g. Supabase).
 *
 *   DATABASE_URL="postgresql://..." node scripts/prepare-pg.mjs
 *
 * The SQLite schema is the source of truth; this script only swaps the
 * provider in the datasource block so the two cannot drift.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SRC = "prisma/schema.prisma";
const OUT = "prisma/schema.pg.prisma";

const schema = readFileSync(SRC, "utf8");
const pg = schema.replace(
  /datasource db \{\s*provider = "sqlite"\s*\}/,
  'datasource db {\n  provider = "postgresql"\n}'
);
if (pg === schema) {
  console.error("Could not find sqlite datasource block to swap.");
  process.exit(1);
}
writeFileSync(OUT, pg);
console.log(`wrote ${OUT}`);

execSync(`npx prisma db push --schema ${OUT}`, { stdio: "inherit" });
