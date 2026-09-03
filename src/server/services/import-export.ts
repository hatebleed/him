import "server-only";

import { and, asc, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";
import { evidence, incidents, persons, reports, tasks, vehicles } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { assertCan, type RequestContext } from "@/server/context";
import { recordAudit } from "@/server/audit/audit";
import { validateCustomValues, writeCustomValues } from "./custom-fields";

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

type ExportDefinition = {
  permission: string;
  columns: Array<{ key: string; label: string; get: (row: Record<string, unknown>) => string }>;
  load: (ctx: RequestContext, search: string) => Promise<Array<Record<string, unknown>>>;
};

const asText = (value: unknown) => (value === null || value === undefined ? "" : String(value));

const EXPORT_DEFINITIONS: Record<string, ExportDefinition> = {
  person: {
    permission: "people.export",
    columns: [
      { key: "reference", label: "Reference", get: (row) => asText(row.reference) },
      { key: "firstName", label: "First name", get: (row) => asText(row.firstName) },
      { key: "lastName", label: "Last name", get: (row) => asText(row.lastName) },
      { key: "status", label: "Status", get: (row) => asText(row.status) },
      { key: "dateOfBirth", label: "Date of birth", get: (row) => (row.dateOfBirth ? new Date(row.dateOfBirth as string).toISOString().slice(0, 10) : "") },
      { key: "occupation", label: "Occupation", get: (row) => asText(row.occupation) },
      { key: "createdAt", label: "Created", get: (row) => new Date(row.createdAt as string).toISOString() },
    ],
    load: async (ctx, search) => {
      assertCan(ctx, "people.export");
      const conditions: SQL[] = [isNull(persons.deletedAt)];
      if (search) conditions.push(or(...[persons.firstName, persons.lastName, persons.reference].map((column) => ilikeSafe(column, search)))!);
      return db.select().from(persons).where(and(...conditions)).orderBy(desc(persons.createdAt)).limit(5000) as Promise<Array<Record<string, unknown>>>;
    },
  },
  vehicle: {
    permission: "vehicles.export",
    columns: [
      { key: "reference", label: "Reference", get: (row) => asText(row.reference) },
      { key: "registration", label: "Registration", get: (row) => asText(row.registration) },
      { key: "make", label: "Make", get: (row) => asText(row.make) },
      { key: "model", label: "Model", get: (row) => asText(row.model) },
      { key: "colour", label: "Colour", get: (row) => asText(row.colour) },
      { key: "status", label: "Status", get: (row) => asText(row.status) },
      { key: "createdAt", label: "Created", get: (row) => new Date(row.createdAt as string).toISOString() },
    ],
    load: async (ctx, search) => {
      assertCan(ctx, "vehicles.export");
      const conditions: SQL[] = [isNull(vehicles.deletedAt)];
      if (search) conditions.push(or(...[vehicles.registration, vehicles.make, vehicles.model].map((column) => ilikeSafe(column, search)))!);
      return db.select().from(vehicles).where(and(...conditions)).orderBy(desc(vehicles.createdAt)).limit(5000) as Promise<Array<Record<string, unknown>>>;
    },
  },
  incident: {
    permission: "incidents.export",
    columns: [
      { key: "reference", label: "Reference", get: (row) => asText(row.reference) },
      { key: "title", label: "Title", get: (row) => asText(row.title) },
      { key: "status", label: "Status", get: (row) => asText(row.status) },
      { key: "priority", label: "Priority", get: (row) => asText(row.priority) },
      { key: "location", label: "Location", get: (row) => asText(row.location) },
      { key: "reportedAt", label: "Reported", get: (row) => (row.reportedAt ? new Date(row.reportedAt as string).toISOString() : "") },
    ],
    load: async (ctx, search) => {
      assertCan(ctx, "incidents.export");
      const conditions: SQL[] = [isNull(incidents.deletedAt)];
      if (search) conditions.push(or(...[incidents.reference, incidents.title].map((column) => ilikeSafe(column, search)))!);
      return db.select().from(incidents).where(and(...conditions)).orderBy(desc(incidents.reportedAt)).limit(5000) as Promise<Array<Record<string, unknown>>>;
    },
  },
  report: {
    permission: "reports.export",
    columns: [
      { key: "reference", label: "Reference", get: (row) => asText(row.reference) },
      { key: "title", label: "Title", get: (row) => asText(row.title) },
      { key: "status", label: "Status", get: (row) => asText(row.status) },
      { key: "currentVersion", label: "Version", get: (row) => asText(row.currentVersion) },
      { key: "createdAt", label: "Created", get: (row) => new Date(row.createdAt as string).toISOString() },
    ],
    load: async (ctx, search) => {
      assertCan(ctx, "reports.export");
      const conditions: SQL[] = [isNull(reports.deletedAt)];
      if (search) conditions.push(or(...[reports.reference, reports.title].map((column) => ilikeSafe(column, search)))!);
      return db.select().from(reports).where(and(...conditions)).orderBy(desc(reports.createdAt)).limit(5000) as Promise<Array<Record<string, unknown>>>;
    },
  },
  task: {
    permission: "tasks.view",
    columns: [
      { key: "reference", label: "Reference", get: (row) => asText(row.reference) },
      { key: "title", label: "Title", get: (row) => asText(row.title) },
      { key: "status", label: "Status", get: (row) => asText(row.status) },
      { key: "priority", label: "Priority", get: (row) => asText(row.priority) },
      { key: "dueAt", label: "Due", get: (row) => (row.dueAt ? new Date(row.dueAt as string).toISOString() : "") },
    ],
    load: async (ctx, search) => {
      assertCan(ctx, "tasks.view");
      const conditions: SQL[] = [isNull(tasks.deletedAt)];
      if (search) conditions.push(or(...[tasks.reference, tasks.title].map((column) => ilikeSafe(column, search)))!);
      return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt)).limit(5000) as Promise<Array<Record<string, unknown>>>;
    },
  },
  evidence: {
    permission: "evidence.view",
    columns: [
      { key: "itemNumber", label: "Item number", get: (row) => asText(row.itemNumber) },
      { key: "description", label: "Description", get: (row) => asText(row.description) },
      { key: "status", label: "Status", get: (row) => asText(row.status) },
      { key: "location", label: "Location", get: (row) => asText(row.location) },
      { key: "createdAt", label: "Created", get: (row) => new Date(row.createdAt as string).toISOString() },
    ],
    load: async (ctx, search) => {
      assertCan(ctx, "evidence.view");
      const conditions: SQL[] = [isNull(evidence.deletedAt)];
      if (search) conditions.push(or(...[evidence.itemNumber, evidence.description].map((column) => ilikeSafe(column, search)))!);
      return db.select().from(evidence).where(and(...conditions)).orderBy(desc(evidence.createdAt)).limit(5000) as Promise<Array<Record<string, unknown>>>;
    },
  },
};

function ilikeSafe(column: SQL | PgColumn, term: string): SQL {
  return ilike(column, `%${term}%`);
}

export const exportService = {
  supportedTypes() {
    return Object.keys(EXPORT_DEFINITIONS);
  },

  async toCsv(ctx: RequestContext, resourceType: string, search = ""): Promise<{ fileName: string; csv: string }> {
    const definition = EXPORT_DEFINITIONS[resourceType];
    if (!definition) throw AppError.badRequest(`Export is not supported for "${resourceType}".`);
    assertCan(ctx, definition.permission);

    const rows = await definition.load(ctx, search);
    const header = definition.columns.map((column) => column.label).join(",");
    const body = rows
      .map((row) => definition.columns.map((column) => escapeCsv(column.get(row))).join(","))
      .join("\n");

    await recordAudit({
      action: "export.csv",
      resourceType,
      summary: `Exported ${rows.length} ${resourceType} records to CSV`,
      metadata: { search },
    });

    return { fileName: `${resourceType}-export-${new Date().toISOString().slice(0, 10)}.csv`, csv: `${header}\n${body}\n` };
  },
};

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

type ImportDefinition = {
  permission: string;
  fields: Array<{ key: string; label: string; required?: boolean }>;
  validateRow: (row: Record<string, unknown>) => string[];
  commitRow: (ctx: RequestContext, row: Record<string, unknown>) => Promise<string>;
};

const IMPORT_DEFINITIONS: Record<string, ImportDefinition> = {
  person: {
    permission: "people.import",
    fields: [
      { key: "firstName", label: "First name", required: true },
      { key: "lastName", label: "Last name", required: true },
      { key: "dateOfBirth", label: "Date of birth" },
      { key: "gender", label: "Gender" },
      { key: "nationality", label: "Nationality" },
      { key: "occupation", label: "Occupation" },
      { key: "status", label: "Status" },
      { key: "notes", label: "Notes" },
    ],
    validateRow: (row) => {
      const issues: string[] = [];
      if (!row.firstName) issues.push("First name is required.");
      if (!row.lastName) issues.push("Last name is required.");
      if (row.dateOfBirth && Number.isNaN(Date.parse(String(row.dateOfBirth)))) issues.push("Date of birth is not a valid date.");
      return issues;
    },
    commitRow: async (ctx, row) => {
      const { peopleService } = await import("./people");
      const created = await peopleService.create(ctx, {
        firstName: String(row.firstName ?? ""),
        lastName: String(row.lastName ?? ""),
        middleName: null,
        alias: null,
        dateOfBirth: row.dateOfBirth ? new Date(String(row.dateOfBirth)) : null,
        gender: (row.gender as string) ?? null,
        nationality: (row.nationality as string) ?? null,
        occupation: (row.occupation as string) ?? null,
        status: (row.status as string) ?? "ACTIVE",
        riskLevel: null,
        categoryId: null,
        departmentId: null,
        notes: (row.notes as string) ?? null,
        identifiers: [],
        contacts: [],
        addresses: [],
      });
      return created.reference;
    },
  },
  vehicle: {
    permission: "vehicles.import",
    fields: [
      { key: "registration", label: "Registration", required: true },
      { key: "make", label: "Make" },
      { key: "model", label: "Model" },
      { key: "year", label: "Year" },
      { key: "colour", label: "Colour" },
      { key: "bodyType", label: "Body type" },
      { key: "status", label: "Status" },
    ],
    validateRow: (row) => {
      const issues: string[] = [];
      if (!row.registration) issues.push("Registration is required.");
      if (row.year && Number.isNaN(Number(row.year))) issues.push("Year must be a number.");
      return issues;
    },
    commitRow: async (ctx, row) => {
      const { vehicleService } = await import("./vehicles");
      const created = await vehicleService.create(ctx, {
        registration: String(row.registration ?? ""),
        make: (row.make as string) ?? null,
        model: (row.model as string) ?? null,
        year: row.year ? Number(row.year) : null,
        colour: (row.colour as string) ?? null,
        bodyType: (row.bodyType as string) ?? null,
        fuelType: null,
        vin: null,
        engineSize: null,
        status: (row.status as string) ?? "ACTIVE",
        categoryId: null,
        departmentId: null,
        notes: null,
      });
      return created.registration;
    },
  },
};

export const importService = {
  definitions(ctx: RequestContext) {
    assertCan(ctx, "admin.access");
    return Object.entries(IMPORT_DEFINITIONS).map(([key, definition]) => ({ resourceType: key, fields: definition.fields }));
  },

  /** Parses CSV text into rows using a simple, quote-aware parser. */
  parseCsv(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };
    const parseLine = (line: string): string[] => {
      const cells: string[] = [];
      let current = "";
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index]!;
        if (char === '"') {
          if (quoted && line[index + 1] === '"') {
            current += '"';
            index += 1;
          } else {
            quoted = !quoted;
          }
        } else if (char === "," && !quoted) {
          cells.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      cells.push(current);
      return cells.map((cell) => cell.trim());
    };

    const headers = parseLine(lines[0]!);
    const rows = lines.slice(1).map((line) => {
      const cells = parseLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    });
    return { headers, rows };
  },

  /**
   * Validates mapped rows without writing anything, so the administrator can
   * review the error report before committing.
   */
  async preview(ctx: RequestContext, resourceType: string, mapping: Record<string, string>, rows: Array<Record<string, unknown>>) {
    const definition = IMPORT_DEFINITIONS[resourceType];
    if (!definition) throw AppError.badRequest(`Import is not supported for "${resourceType}".`);
    assertCan(ctx, definition.permission);

    const mapped = rows.map((row) => Object.fromEntries(Object.entries(mapping).map(([target, source]) => [target, row[source] ?? null])));
    const errors: Array<{ row: number; issues: string[] }> = [];
    mapped.forEach((row, index) => {
      const issues = definition.validateRow(row);
      if (issues.length) errors.push({ row: index + 2, issues });
    });

    return { total: mapped.length, valid: mapped.length - errors.length, invalid: errors.length, errors, sample: mapped.slice(0, 5) };
  },

  async commit(ctx: RequestContext, resourceType: string, mapping: Record<string, string>, rows: Array<Record<string, unknown>>) {
    const definition = IMPORT_DEFINITIONS[resourceType];
    if (!definition) throw AppError.badRequest(`Import is not supported for "${resourceType}".`);
    assertCan(ctx, definition.permission);

    const mapped = rows.map((row) => Object.fromEntries(Object.entries(mapping).map(([target, source]) => [target, row[source] ?? null])));
    const created: string[] = [];
    const failed: Array<{ row: number; issues: string[] }> = [];

    for (let index = 0; index < mapped.length; index += 1) {
      const row = mapped[index]!;
      const issues = definition.validateRow(row);
      if (issues.length) {
        failed.push({ row: index + 2, issues });
        continue;
      }
      try {
        const identifier = await definition.commitRow(ctx, row);
        created.push(identifier);
      } catch (error) {
        failed.push({ row: index + 2, issues: [(error as Error).message] });
      }
    }

    await recordAudit({
      action: "import.committed",
      resourceType,
      summary: `Imported ${created.length} ${resourceType} records`,
      metadata: { failed: failed.length, total: mapped.length },
    });

    return { created: created.length, failed };
  },
};

export { asc, eq, validateCustomValues, writeCustomValues };
