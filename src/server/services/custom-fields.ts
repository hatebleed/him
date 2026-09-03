import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { customFieldDefinitions, customFieldValues } from "@/lib/db/schema";
import { getCustomFields, invalidateConfiguration } from "@/server/configuration/service";
import { AppError } from "@/lib/errors";

export type CustomValue = string | number | boolean | null | string[];

/**
 * Custom field engine: definitions are configuration, values are stored in a
 * single keyed table. Adding a field never requires a schema migration and
 * never adds a column.
 */
export async function readCustomValues(
  resourceType: string,
  recordIds: string[],
): Promise<Map<string, Record<string, CustomValue>>> {
  const result = new Map<string, Record<string, CustomValue>>();
  if (recordIds.length === 0) return result;
  const definitions = await getCustomFields(resourceType);
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition] as const));
  if (definitions.length === 0) return result;

  const rows = await db
    .select()
    .from(customFieldValues)
    .where(
      and(
        inArray(
          customFieldValues.definitionId,
          definitions.map((definition) => definition.id),
        ),
        inArray(customFieldValues.recordId, recordIds),
      ),
    );

  for (const recordId of recordIds) result.set(recordId, {});
  for (const row of rows) {
    const definition = definitionById.get(row.definitionId);
    if (!definition) continue;
    const bucket = result.get(row.recordId) ?? {};
    bucket[definition.key] = (row.valueJson as CustomValue | null) ?? row.value ?? null;
    result.set(row.recordId, bucket);
  }
  return result;
}

export async function readCustomValuesForRecord(resourceType: string, recordId: string): Promise<Record<string, CustomValue>> {
  const map = await readCustomValues(resourceType, [recordId]);
  return map.get(recordId) ?? {};
}

export type ValidationIssue = { field: string; message: string };

/** Server-side validation of submitted custom field values. */
export async function validateCustomValues(
  resourceType: string,
  values: Record<string, unknown> | undefined,
): Promise<ValidationIssue[]> {
  const definitions = await getCustomFields(resourceType);
  const issues: ValidationIssue[] = [];
  if (!definitions.length) return issues;

  for (const definition of definitions) {
    const raw = values?.[definition.key];
    const empty = raw === undefined || raw === null || raw === "";
    if (definition.required && empty) {
      issues.push({ field: definition.key, message: `${definition.label} is required.` });
      continue;
    }
    if (empty) continue;

    if (definition.type === "NUMBER" || definition.type === "CURRENCY") {
      const numeric = Number(raw);
      if (Number.isNaN(numeric)) issues.push({ field: definition.key, message: `${definition.label} must be a number.` });
      if (definition.validation?.min !== undefined && numeric < definition.validation.min) {
        issues.push({ field: definition.key, message: `${definition.label} must be at least ${definition.validation.min}.` });
      }
      if (definition.validation?.max !== undefined && numeric > definition.validation.max) {
        issues.push({ field: definition.key, message: `${definition.label} must be at most ${definition.validation.max}.` });
      }
    }

    if (definition.validation?.pattern && typeof raw === "string") {
      try {
        if (!new RegExp(definition.validation.pattern).test(raw)) {
          issues.push({ field: definition.key, message: definition.validation.message ?? `${definition.label} is not valid.` });
        }
      } catch {
        /* invalid pattern configured - ignore rather than block the user */
      }
    }

    if ((definition.type === "SELECT" || definition.type === "RADIO") && definition.options?.length) {
      const allowed = new Set(definition.options.map((option) => option.value));
      if (!allowed.has(String(raw))) {
        issues.push({ field: definition.key, message: `${definition.label} has an invalid option.` });
      }
    }

    if (definition.type === "MULTI_SELECT" && definition.options?.length) {
      const allowed = new Set(definition.options.map((option) => option.value));
      const selected = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      if (selected.some((value) => !allowed.has(value))) {
        issues.push({ field: definition.key, message: `${definition.label} has an invalid option.` });
      }
    }
  }
  return issues;
}

export async function writeCustomValues(
  resourceType: string,
  recordId: string,
  values: Record<string, unknown> | undefined,
): Promise<void> {
  const definitions = await getCustomFields(resourceType);
  if (definitions.length === 0 || !values) return;

  const issues = await validateCustomValues(resourceType, values);
  if (issues.length > 0) {
    throw AppError.badRequest("Some custom fields are invalid.", issues);
  }

  for (const definition of definitions) {
    if (!(definition.key in values)) continue;
    const raw = values[definition.key];
    if (raw === undefined) continue;

    const payload = {
      value: Array.isArray(raw) ? raw.join(",") : raw === null ? null : String(raw),
      valueJson: (Array.isArray(raw) ? raw : raw === null ? null : raw) as never,
    };

    await db
      .insert(customFieldValues)
      .values({ definitionId: definition.id, recordId, ...payload })
      .onConflictDoUpdate({
        target: [customFieldValues.definitionId, customFieldValues.recordId],
        set: payload,
      });
  }
}

export async function deleteCustomValuesForDefinition(definitionId: string): Promise<void> {
  await db.delete(customFieldValues).where(eq(customFieldValues.definitionId, definitionId));
}

export async function deleteCustomValuesForRecord(resourceType: string, recordId: string): Promise<void> {
  const definitions = await db
    .select({ id: customFieldDefinitions.id })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.resourceType, resourceType));
  const ids = definitions.map((row) => row.id);
  if (ids.length === 0) return;
  await db.delete(customFieldValues).where(and(inArray(customFieldValues.definitionId, ids), eq(customFieldValues.recordId, recordId)));
}

export { invalidateConfiguration };
