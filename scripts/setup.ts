/**
 * One-shot bootstrap for a fresh checkout:
 *
 *   npm install
 *   npm run setup
 *
 * Starts the local PostgreSQL instance (when the embedded distribution is
 * available), applies migrations and seeds the demonstration dataset.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { applyMigrations } from "../src/lib/db/migrate";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/him?schema=public";

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
  });
}

async function main() {
  const binDir = "node_modules/@embedded-postgres/linux-x64/native/bin";
  if (existsSync(binDir)) {
    console.log("Starting the local PostgreSQL instance…");
    await run("npx", ["tsx", "scripts/dev-db.ts", "start"]);
  } else {
    console.log("No local PostgreSQL distribution found; using DATABASE_URL as provided.");
  }

  console.log("Applying migrations…");
  await applyMigrations(url);
  console.log("Migrations applied.");

  console.log("Seeding demonstration data…");
  const { seed } = await import("./seed");
  await seed();

  console.log("\nSetup complete. Start the application with: npm run dev");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
