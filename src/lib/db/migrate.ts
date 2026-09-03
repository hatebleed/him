import { readdir } from "node:fs/promises";
import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

import * as schema from "./schema";

export const MIGRATIONS_DIR = path.resolve(process.cwd(), "drizzle");

function urlWith(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

/** Creates the target database when it does not exist yet. */
export async function ensureDatabase(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  const database = decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres";
  const admin = new Client({ connectionString: urlWith(connectionString, "postgres") });
  try {
    await admin.connect();
    const result = await admin.query<{ exists: boolean }>("SELECT 1 AS exists FROM pg_database WHERE datname = $1", [
      database,
    ]);
    if (result.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
      console.log(`Created database "${database}".`);
    }
  } finally {
    await admin.end().catch(() => undefined);
  }
}

/** Applies every pending migration in ./drizzle, in order. */
export async function applyMigrations(connectionString: string, quiet = false): Promise<void> {
  await ensureDatabase(connectionString);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const db = drizzle(client, { schema });
    // The migration ledger lives in `public` so a schema reset drops it too.
    await runMigrations(db, { migrationsFolder: MIGRATIONS_DIR, migrationsSchema: "public" });
    if (!quiet) console.log("Migrations applied.");
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function countMigrations(): Promise<number> {
  try {
    const files = await readdir(MIGRATIONS_DIR);
    return files.filter((file) => file.endsWith(".sql")).length;
  } catch {
    return 0;
  }
}
