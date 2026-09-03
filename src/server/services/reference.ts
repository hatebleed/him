import "server-only";

import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";

/**
 * Human-friendly sequential references (e.g. `INC-2026-0007`).
 *
 * A lightweight counter query plus a uniqueness retry is used instead of a
 * mutable sequence table: it keeps the schema simple and the (rare) collision
 * is caught by the unique index and retried.
 */
export async function nextReference(table: PgTable, prefix: string, column = "reference"): Promise<string> {
  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [row] = await db
      .select({ max: sql<string>`max(${sql.identifier(column)})` })
      .from(table);
    const current = row?.max ?? "";
    const match = current.match(/(\d+)$/);
    const next = (match ? Number(match[1]) : 0) + 1 + attempt;
    const candidate = `${prefix}-${year}-${String(next).padStart(5, "0")}`;
    const existing = await db
      .select({ id: sql<string>`1` })
      .from(table)
      .where(sql`${sql.identifier(column)} = ${candidate}`)
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  return `${prefix}-${year}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Prefixes used across the platform; centralised so seed and UI agree. */
export const REFERENCE_PREFIXES = {
  person: "PPL",
  vehicle: "VEH",
  incident: "INC",
  case: "CAS",
  report: "RPT",
  task: "TSK",
  warrant: "WAR",
  alert: "ALR",
  bolo: "BLO",
  evidence: "EVD",
  call: "CAL",
} as const;
