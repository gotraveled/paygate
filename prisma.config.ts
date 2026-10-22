import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // `env()` throws on missing vars — but `prisma generate` (which runs on
    // every `npm install`, including Vercel builds) doesn't need a live
    // datasource. Fall back to the local dev db when DATABASE_URL is unset.
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
