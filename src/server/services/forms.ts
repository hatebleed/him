import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { formFields, formSubmissions, forms } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { recordAudit, recordTimeline } from "@/server/audit/audit";
import { assertCan, type RequestContext } from "@/server/context";
import { runWorkflows } from "@/server/workflows/engine";

/** Re-exported so callers can import validation without pulling in the DB. */
export { formFieldInputSchema, formInputSchema, formUpdateSchema } from "@/lib/validation/forms";

import type { FormFieldInput } from "@/lib/validation/forms";

export const formService = {
  async list(ctx: RequestContext) {
    assertCan(ctx, "admin.forms.manage");
    const rows = await db.select().from(forms).orderBy(asc(forms.name));
    const fieldCounts = await db.select({ formId: formFields.formId }).from(formFields);
    const counts = new Map<string, number>();
    for (const row of fieldCounts) counts.set(row.formId, (counts.get(row.formId) ?? 0) + 1);
    return rows.map((form) => ({ ...form, fieldCount: counts.get(form.id) ?? 0 }));
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.forms.manage");
    const [form] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
    if (!form) throw AppError.notFound("This form does not exist.");
    const fields = await db.select().from(formFields).where(eq(formFields.formId, id)).orderBy(asc(formFields.sortOrder));
    return { ...form, fields };
  },

  async getByKey(ctx: RequestContext, key: string) {
    assertCan(ctx, "forms.view" as never);
    const [form] = await db.select().from(forms).where(eq(forms.key, key)).limit(1);
    if (!form) throw AppError.notFound("This form does not exist.");
    const fields = await db.select().from(formFields).where(eq(formFields.formId, form.id)).orderBy(asc(formFields.sortOrder));
    return { ...form, fields };
  },

  async create(ctx: RequestContext, input: { key: string; name: string; description?: string | null; resourceType: string; fields?: FormFieldInput[] }) {
    assertCan(ctx, "admin.forms.manage");
    const key = input.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const [existing] = await db.select({ id: forms.id }).from(forms).where(eq(forms.key, key)).limit(1);
    if (existing) throw AppError.conflict("A form with that key already exists.");

    const [form] = await db
      .insert(forms)
      .values({ key, name: input.name, description: input.description ?? null, resourceType: input.resourceType, createdById: ctx.user.id })
      .returning();

    if (input.fields?.length) await this.replaceFields(form!.id, input.fields);

    await recordAudit({ action: "form.created", resourceType: "form", resourceId: form!.id, summary: `Created form ${input.name}` });
    return form;
  },

  async update(ctx: RequestContext, id: string, input: { name?: string; description?: string | null; resourceType?: string; status?: string; fields?: FormFieldInput[] }) {
    assertCan(ctx, "admin.forms.manage");
    const [existing] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This form does not exist.");

    const [updated] = await db
      .update(forms)
      .set({
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        resourceType: input.resourceType ?? existing.resourceType,
        status: input.status ?? existing.status,
        version: input.fields ? existing.version + 1 : existing.version,
      })
      .where(eq(forms.id, id))
      .returning();

    if (input.fields) await this.replaceFields(id, input.fields);

    await recordAudit({
      action: "form.updated",
      resourceType: "form",
      resourceId: id,
      summary: `Updated form ${existing.name}`,
      previousValue: { status: existing.status },
      newValue: { status: updated!.status },
    });
    return updated;
  },

  /** Replaces the field set atomically (the builder submits the full form). */
  async replaceFields(formId: string, fields: FormFieldInput[]) {
    await db.transaction(async (tx) => {
      await tx.delete(formFields).where(eq(formFields.formId, formId));
      if (fields.length === 0) return;
      await tx.insert(formFields).values(
        fields.map((field, index) => ({
          formId,
          key: field.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          label: field.label,
          type: field.type ?? "TEXT",
          section: field.section ?? null,
          helpText: field.helpText ?? null,
          placeholder: field.placeholder ?? null,
          required: field.required ?? false,
          defaultValue: field.defaultValue ?? null,
          options: field.options ?? null,
          validation: field.validation ?? null,
          conditions: field.conditions ?? null,
          width: field.width ?? "full",
          sortOrder: field.sortOrder ?? index,
        })),
      );
    });
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.forms.manage");
    const [existing] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This form does not exist.");
    await db.delete(forms).where(eq(forms.id, id));
    await recordAudit({ action: "form.deleted", resourceType: "form", resourceId: id, summary: `Deleted form ${existing.name}` });
    return { id };
  },

  /** Validates a submission against the published field definitions. */
  validateSubmission(fields: Array<{ key: string; label: string; type: string; required: boolean; options?: Array<{ label: string; value: string }> | null; validation?: { min?: number; max?: number; pattern?: string; message?: string } | null }>, data: Record<string, unknown>) {
    const issues: Array<{ field: string; message: string }> = [];
    for (const field of fields) {
      const raw = data[field.key];
      const empty = raw === undefined || raw === null || raw === "";
      if (field.required && empty) {
        issues.push({ field: field.key, message: `${field.label} is required.` });
        continue;
      }
      if (empty) continue;
      if ((field.type === "NUMBER" || field.type === "CURRENCY") && Number.isNaN(Number(raw))) {
        issues.push({ field: field.key, message: `${field.label} must be a number.` });
      }
      if (field.validation?.pattern && typeof raw === "string" && !new RegExp(field.validation.pattern).test(raw)) {
        issues.push({ field: field.key, message: field.validation.message ?? `${field.label} is not valid.` });
      }
      if ((field.type === "SELECT" || field.type === "RADIO") && field.options?.length) {
        const allowed = new Set(field.options.map((option) => option.value));
        if (!allowed.has(String(raw))) issues.push({ field: field.key, message: `${field.label} has an invalid option.` });
      }
    }
    return issues;
  },

  async submit(ctx: RequestContext, formId: string, data: Record<string, unknown>, options: { recordType?: string | null; recordId?: string | null } = {}) {
    assertCan(ctx, "reports.create");
    const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
    if (!form) throw AppError.notFound("This form does not exist.");
    if (form.status !== "PUBLISHED") throw AppError.conflict("Only published forms can be submitted.");

    const fields = await db.select().from(formFields).where(eq(formFields.formId, formId)).orderBy(asc(formFields.sortOrder));
    const issues = this.validateSubmission(fields, data);
    if (issues.length) throw AppError.badRequest("The form has validation errors.", issues);

    const previous = await db
      .select({ version: formSubmissions.version })
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .orderBy(desc(formSubmissions.version))
      .limit(1);
    const version = (previous[0]?.version ?? 0) + 1;

    const [submission] = await db
      .insert(formSubmissions)
      .values({
        formId,
        recordType: options.recordType ?? null,
        recordId: options.recordId ?? null,
        version,
        data,
        status: "SUBMITTED",
        submittedById: ctx.user.id,
        submittedAt: new Date(),
      })
      .returning();

    await recordAudit({
      action: "form.submitted",
      resourceType: "form",
      resourceId: formId,
      summary: `Submitted form ${form.name} (v${version})`,
      newValue: { submissionId: submission!.id, recordType: options.recordType, recordId: options.recordId },
    });

    if (options.recordType && options.recordId) {
      await recordTimeline({
        recordType: options.recordType,
        recordId: options.recordId,
        type: "FORM",
        message: `Form "${form.name}" submitted by ${ctx.user.name}`,
      });
    }

    await runWorkflows({
      trigger: "FORM_SUBMITTED",
      resourceType: options.recordType ?? form.resourceType,
      recordId: options.recordId ?? submission!.id,
      context: { formKey: form.key, data },
    });

    return submission;
  },

  async submissions(ctx: RequestContext, formId: string, limit = 50) {
    assertCan(ctx, "admin.forms.manage");
    return db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(limit);
  },

  async submissionsForRecord(ctx: RequestContext, recordType: string, recordId: string) {
    assertCan(ctx, "reports.view");
    return db
      .select({
        id: formSubmissions.id,
        version: formSubmissions.version,
        data: formSubmissions.data,
        createdAt: formSubmissions.createdAt,
        formId: formSubmissions.formId,
      })
      .from(formSubmissions)
      .where(eq(formSubmissions.recordId, recordId))
      .orderBy(desc(formSubmissions.createdAt));
  },
};

/** Fields visible once conditional rules are applied to current values. */
export function visibleFields<T extends { conditions?: Array<{ field: string; operator: string; value: string }> | null }>(
  fields: T[],
  values: Record<string, unknown>,
  evaluate: (operator: string, left: unknown, right: string | null) => boolean,
): T[] {
  return fields.filter((field) => {
    if (!field.conditions?.length) return true;
    return field.conditions.every((condition) =>
      evaluate(condition.operator, values[condition.field], condition.value),
    );
  });
}
