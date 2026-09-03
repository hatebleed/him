/**
 * Applies all pending SQL migrations from ./drizzle.
 * Creates the target database first when it is missing.
 */
import { applyMigrations } from "../src/lib/db/migrate";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/him?schema=public";

applyMigrations(url)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
