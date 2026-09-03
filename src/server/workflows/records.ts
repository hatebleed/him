import "server-only";

import { eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";
import { alerts, bolos, calls, cases, evidence, incidents, persons, reports, tasks, vehicles, warrants } from "@/lib/db/schema";

/**
 * Record adapter registry.
 *
 * The workflow engine (and other generic subsystems such as notes,
 * attachments and search) address records through this registry, so a new
 * record type becomes workflow-aware by adding one entry here - no engine
 * changes required.
 */
export type RecordAdapter = {
  resourceType: string;
  table: PgTable;
  idColumn: PgColumn;
  statusColumn: PgColumn;
  referenceColumn?: PgColumn;
  titleColumn?: PgColumn;
  permissionPrefix: string;
};

export const RECORD_ADAPTERS: Record<string, RecordAdapter> = {
  incident: {
    resourceType: "incident",
    table: incidents,
    idColumn: incidents.id,
    statusColumn: incidents.status,
    referenceColumn: incidents.reference,
    titleColumn: incidents.title,
    permissionPrefix: "incidents",
  },
  case: {
    resourceType: "case",
    table: cases,
    idColumn: cases.id,
    statusColumn: cases.status,
    referenceColumn: cases.reference,
    titleColumn: cases.title,
    permissionPrefix: "cases",
  },
  report: {
    resourceType: "report",
    table: reports,
    idColumn: reports.id,
    statusColumn: reports.status,
    referenceColumn: reports.reference,
    titleColumn: reports.title,
    permissionPrefix: "reports",
  },
  task: {
    resourceType: "task",
    table: tasks,
    idColumn: tasks.id,
    statusColumn: tasks.status,
    referenceColumn: tasks.reference,
    titleColumn: tasks.title,
    permissionPrefix: "tasks",
  },
  person: {
    resourceType: "person",
    table: persons,
    idColumn: persons.id,
    statusColumn: persons.status,
    referenceColumn: persons.reference,
    permissionPrefix: "people",
  },
  vehicle: {
    resourceType: "vehicle",
    table: vehicles,
    idColumn: vehicles.id,
    statusColumn: vehicles.status,
    referenceColumn: vehicles.reference,
    permissionPrefix: "vehicles",
  },
  warrant: {
    resourceType: "warrant",
    table: warrants,
    idColumn: warrants.id,
    statusColumn: warrants.status,
    referenceColumn: warrants.reference,
    permissionPrefix: "warrants",
  },
  alert: {
    resourceType: "alert",
    table: alerts,
    idColumn: alerts.id,
    statusColumn: alerts.status,
    referenceColumn: alerts.reference,
    titleColumn: alerts.subject,
    permissionPrefix: "alerts",
  },
  bolo: {
    resourceType: "bolo",
    table: bolos,
    idColumn: bolos.id,
    statusColumn: bolos.status,
    referenceColumn: bolos.reference,
    titleColumn: bolos.subject,
    permissionPrefix: "bolos",
  },
  evidence: {
    resourceType: "evidence",
    table: evidence,
    idColumn: evidence.id,
    statusColumn: evidence.status,
    referenceColumn: evidence.itemNumber,
    titleColumn: evidence.description,
    permissionPrefix: "evidence",
  },
  call: {
    resourceType: "call",
    table: calls,
    idColumn: calls.id,
    statusColumn: calls.status,
    referenceColumn: calls.reference,
    titleColumn: calls.description,
    permissionPrefix: "calls",
  },
};

export function getRecordAdapter(resourceType: string): RecordAdapter | undefined {
  return RECORD_ADAPTERS[resourceType];
}

export async function readRecordStatus(resourceType: string, recordId: string): Promise<{ status: string | null; reference: string | null }> {
  const adapter = getRecordAdapter(resourceType);
  if (!adapter) return { status: null, reference: null };
  const [row] = await db
    .select({
      status: adapter.statusColumn,
      reference: adapter.referenceColumn ?? adapter.idColumn,
    })
    .from(adapter.table)
    .where(eq(adapter.idColumn, recordId))
    .limit(1);
  return { status: (row?.status as string) ?? null, reference: (row?.reference as string) ?? null };
}

export async function writeRecordStatus(resourceType: string, recordId: string, status: string): Promise<boolean> {
  const adapter = getRecordAdapter(resourceType);
  if (!adapter) return false;
  await db.update(adapter.table).set({ [adapter.statusColumn.name]: status } as never).where(eq(adapter.idColumn, recordId));
  return true;
}

export { eq as recordEq, type SQL };
