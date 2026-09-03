/**
 * Destructive development helper: drops and recreates the public schema,
 * re-applies migrations and re-seeds demo data.
 * Never run this against a production database.
 */
import { Client } from "pg";

import { applyMigrations, ensureDatabase } from "../src/lib/db/migrate";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/him?schema=public";

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(url) && process.env.FORCE_RESET !== "true") {
    throw new Error("Refusing to reset a non-local database. Set FORCE_RESET=true to override.");
  }
  await ensureDatabase(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await client.end();
  console.log("Schema dropped.");
  await applyMigrations(url, true);
  console.log("Migrations applied.");
  const { seed } = await import("./seed");
  await seed();
  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
