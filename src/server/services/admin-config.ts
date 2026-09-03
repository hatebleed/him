import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { categoryDefinitions, customFieldDefinitions, statusDefinitions } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { z } from "zod";
import { recordAudit } from "@/server/audit/audit";
import { assertCan, type RequestContext } from "@/server/context";
import { invalidateConfiguration } from "@/server/configuration/service";

/**
 * Administration of configurable concepts: statuses, categories and custom
 * field definitions. Every write invalidates the configuration cache so the
 * running application picks the change up immediately.
 */
const conditionsSchema = z.array(z.object({ field: z.string(), operator: z.string(), value: z.string() })).nullish();
const validationSchema = z
  .object({ min: z.number().optional(), max: z.number().optional(), pattern: z.string().optional(), message: z.string().optional() })
  .nullish();
const optionsSchema = z.array(z.object({ label: z.string(), value: z.string() })).nullish();

export const customFieldInputSchema = z.object({
  resourceType: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.string().default("TEXT"),
  section: z.string().nullish(),
  helpText: z.string().nullish(),
  placeholder: z.string().nullish(),
  required: z.boolean().default(false),
  defaultValue: z.string().nullish(),
  options: optionsSchema,
  validation: validationSchema,
  conditions: conditionsSchema,
  showInList: z.boolean().default(false),
  sortOrder: z.number().default(100),
});

export const customFieldUpdateSchema = z.object({
  label: z.string().min(1).optional(),
  type: z.string().optional(),
  section: z.string().nullish(),
  helpText: z.string().nullish(),
  placeholder: z.string().nullish(),
  required: z.boolean().optional(),
  defaultValue: z.string().nullish(),
  options: optionsSchema,
  validation: validationSchema,
  conditions: conditionsSchema,
  showInList: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const adminConfigService = {
  // ---------------------------------------------------------------- statuses
  async listStatuses(ctx: RequestContext, resourceType?: string) {
    assertCan(ctx, "admin.statuses.manage");
    const rows = await db
      .select()
      .from(statusDefinitions)
      .where(resourceType ? eq(statusDefinitions.resourceType, resourceType) : undefined)
      .orderBy(asc(statusDefinitions.resourceType), asc(statusDefinitions.sortOrder));
    return rows;
  },

  async createStatus(
    ctx: RequestContext,
    input: { resourceType: string; key: string; label: string; colour?: string; icon?: string | null; description?: string | null; isDefault?: boolean; isClosed?: boolean; sortOrder?: number },
  ) {
    assertCan(ctx, "admin.statuses.manage");
    const key = input.key.trim().toUpperCase();
    const [existing] = await db
      .select({ id: statusDefinitions.id })
      .from(statusDefinitions)
      .where(eq(statusDefinitions.key, key))
      .limit(1);
    if (existing) throw AppError.conflict("A status with that key already exists for this resource.");

    if (input.isDefault) {
      await db
        .update(statusDefinitions)
        .set({ isDefault: false })
        .where(eq(statusDefinitions.resourceType, input.resourceType));
    }

    const [created] = await db
      .insert(statusDefinitions)
      .values({
        resourceType: input.resourceType,
        key,
        label: input.label,
        colour: input.colour ?? "#64748b",
        icon: input.icon ?? null,
        description: input.description ?? null,
        isDefault: input.isDefault ?? false,
        isClosed: input.isClosed ?? false,
        sortOrder: input.sortOrder ?? 100,
      })
      .returning();

    invalidateConfiguration("statuses");
    await recordAudit({ action: "config.status.created", resourceType: input.resourceType, resourceId: created!.id, summary: `Created status ${input.label}` });
    return created;
  },

  async updateStatus(
    ctx: RequestContext,
    id: string,
    input: { label?: string; colour?: string; icon?: string | null; description?: string | null; isDefault?: boolean; isClosed?: boolean; active?: boolean; sortOrder?: number },
  ) {
    assertCan(ctx, "admin.statuses.manage");
    const [existing] = await db.select().from(statusDefinitions).where(eq(statusDefinitions.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This status does not exist.");

    if (input.isDefault) {
      await db.update(statusDefinitions).set({ isDefault: false }).where(eq(statusDefinitions.resourceType, existing.resourceType));
    }

    const [updated] = await db
      .update(statusDefinitions)
      .set({
        label: input.label ?? existing.label,
        colour: input.colour ?? existing.colour,
        icon: input.icon ?? existing.icon,
        description: input.description ?? existing.description,
        isDefault: input.isDefault ?? existing.isDefault,
        isClosed: input.isClosed ?? existing.isClosed,
        active: input.active ?? existing.active,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      })
      .where(eq(statusDefinitions.id, id))
      .returning();

    invalidateConfiguration("statuses");
    await recordAudit({
      action: "config.status.updated",
      resourceType: existing.resourceType,
      resourceId: id,
      summary: `Updated status ${existing.label}`,
      previousValue: { label: existing.label, isClosed: existing.isClosed },
      newValue: { label: updated!.label, isClosed: updated!.isClosed },
    });
    return updated;
  },

  async deleteStatus(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.statuses.manage");
    const [existing] = await db.select().from(statusDefinitions).where(eq(statusDefinitions.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This status does not exist.");
    await db.delete(statusDefinitions).where(eq(statusDefinitions.id, id));
    invalidateConfiguration("statuses");
    await recordAudit({ action: "config.status.deleted", resourceType: existing.resourceType, resourceId: id, summary: `Deleted status ${existing.label}` });
    return { id };
  },

  // -------------------------------------------------------------- categories
  async listCategories(ctx: RequestContext, resourceType?: string) {
    assertCan(ctx, "admin.categories.manage");
    return db
      .select()
      .from(categoryDefinitions)
      .where(resourceType ? eq(categoryDefinitions.resourceType, resourceType) : undefined)
      .orderBy(asc(categoryDefinitions.resourceType), asc(categoryDefinitions.sortOrder));
  },

  async createCategory(
    ctx: RequestContext,
    input: { resourceType: string; key: string; label: string; colour?: string; icon?: string | null; description?: string | null; sortOrder?: number },
  ) {
    assertCan(ctx, "admin.categories.manage");
    const [created] = await db
      .insert(categoryDefinitions)
      .values({
        resourceType: input.resourceType,
        key: input.key.trim().toUpperCase(),
        label: input.label,
        colour: input.colour ?? "#64748b",
        icon: input.icon ?? null,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 100,
      })
      .onConflictDoNothing()
      .returning();
    if (!created) throw AppError.conflict("A category with that key already exists for this resource.");

    invalidateConfiguration("categories");
    await recordAudit({ action: "config.category.created", resourceType: input.resourceType, resourceId: created.id, summary: `Created category ${input.label}` });
    return created;
  },

  async updateCategory(
    ctx: RequestContext,
    id: string,
    input: { label?: string; colour?: string; icon?: string | null; description?: string | null; active?: boolean; sortOrder?: number },
  ) {
    assertCan(ctx, "admin.categories.manage");
    const [existing] = await db.select().from(categoryDefinitions).where(eq(categoryDefinitions.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This category does not exist.");

    const [updated] = await db
      .update(categoryDefinitions)
      .set({
        label: input.label ?? existing.label,
        colour: input.colour ?? existing.colour,
        icon: input.icon ?? existing.icon,
        description: input.description ?? existing.description,
        active: input.active ?? existing.active,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      })
      .where(eq(categoryDefinitions.id, id))
      .returning();

    invalidateConfiguration("categories");
    await recordAudit({ action: "config.category.updated", resourceType: existing.resourceType, resourceId: id, summary: `Updated category ${existing.label}` });
    return updated;
  },

  async deleteCategory(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.categories.manage");
    const [existing] = await db.select().from(categoryDefinitions).where(eq(categoryDefinitions.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This category does not exist.");
    await db.delete(categoryDefinitions).where(eq(categoryDefinitions.id, id));
    invalidateConfiguration("categories");
    await recordAudit({ action: "config.category.deleted", resourceType: existing.resourceType, resourceId: id, summary: `Deleted category ${existing.label}` });
    return { id };
  },

  // ----------------------------------------------------------- custom fields
  async listCustomFields(ctx: RequestContext, resourceType?: string) {
    assertCan(ctx, "admin.fields.manage");
    return db
      .select()
      .from(customFieldDefinitions)
      .where(resourceType ? eq(customFieldDefinitions.resourceType, resourceType) : undefined)
      .orderBy(asc(customFieldDefinitions.resourceType), asc(customFieldDefinitions.sortOrder));
  },

  async createCustomField(ctx: RequestContext, input: z.input<typeof customFieldInputSchema>) {
    assertCan(ctx, "admin.fields.manage");
    const key = input.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const [existing] = await db
      .select({ id: customFieldDefinitions.id })
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.key, key))
      .limit(1);
    if (existing) throw AppError.conflict("A field with that key already exists for this resource.");

    const [created] = await db
      .insert(customFieldDefinitions)
      .values({
        resourceType: input.resourceType,
        key,
        label: input.label,
        type: input.type ?? "TEXT",
        section: input.section ?? null,
        helpText: input.helpText ?? null,
        placeholder: input.placeholder ?? null,
        required: input.required ?? false,
        defaultValue: input.defaultValue ?? null,
        options: input.options ?? null,
        validation: input.validation ?? null,
        conditions: input.conditions ?? null,
        showInList: input.showInList ?? false,
        sortOrder: input.sortOrder ?? 100,
        createdById: ctx.user.id,
      })
      .returning();

    invalidateConfiguration("custom-fields");
    await recordAudit({
      action: "config.field.created",
      resourceType: input.resourceType,
      resourceId: created!.id,
      summary: `Created custom field ${input.label}`,
      newValue: { key, type: input.type ?? "TEXT", required: input.required ?? false },
    });
    return created;
  },

  async updateCustomField(ctx: RequestContext, id: string, input: z.input<typeof customFieldUpdateSchema>) {
    assertCan(ctx, "admin.fields.manage");
    const [existing] = await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This field does not exist.");

    const [updated] = await db.update(customFieldDefinitions).set(input).where(eq(customFieldDefinitions.id, id)).returning();
    invalidateConfiguration("custom-fields");
    await recordAudit({
      action: "config.field.updated",
      resourceType: existing.resourceType,
      resourceId: id,
      summary: `Updated custom field ${existing.label}`,
      previousValue: { label: existing.label, required: existing.required },
      newValue: { label: updated!.label, required: updated!.required },
    });
    return updated;
  },

  async deleteCustomField(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.fields.manage");
    const [existing] = await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This field does not exist.");
    await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, id));
    invalidateConfiguration("custom-fields");
    await recordAudit({
      action: "config.field.deleted",
      resourceType: existing.resourceType,
      resourceId: id,
      summary: `Deleted custom field ${existing.label}`,
      previousValue: { key: existing.key, label: existing.label },
    });
    return { id };
  },
};
