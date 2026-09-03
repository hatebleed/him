import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/him?schema=public";

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
