import { z } from "zod";

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { workflowActions, workflowConditions, workflows } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { authRoute, ok, param } from "@/server/api/handler";
import { assertCan } from "@/server/context";
import { recordAudit } from "@/server/audit/audit";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullish(),
  resourceType: z.string().optional(),
  trigger: z.string().optional(),
  enabled: z.boolean().optional(),
  conditions: z
    .array(z.object({ field: z.string(), operator: z.string().default("EQUALS"), value: z.string().nullish(), conjunction: z.string().default("AND"), sortOrder: z.number().default(0) }))
    .optional(),
  actions: z.array(z.object({ type: z.string(), config: z.record(z.unknown()).default({}), sortOrder: z.number().default(0) })).optional(),
});

export const PATCH = authRoute<{ id: string }>(async (request, context) => {
  assertCan(context, "admin.workflows.manage");
  const id = await param(context.segment, "id" as never);
  const [existing] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  if (!existing) throw AppError.notFound("This workflow does not exist.");

  const body = updateSchema.parse(await request.json().catch(() => ({})));
  const [updated] = await db
    .update(workflows)
    .set({
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      resourceType: body.resourceType ?? existing.resourceType,
      trigger: body.trigger ?? existing.trigger,
      enabled: body.enabled ?? existing.enabled,
    })
    .where(eq(workflows.id, id))
    .returning();

  if (body.conditions) {
    await db.delete(workflowConditions).where(eq(workflowConditions.workflowId, id));
    if (body.conditions.length) {
      await db.insert(workflowConditions).values(
        body.conditions.map((condition) => ({
          workflowId: id,
          field: condition.field,
          operator: condition.operator,
          value: condition.value ?? null,
          conjunction: condition.conjunction,
          sortOrder: condition.sortOrder,
        })),
      );
    }
  }
  if (body.actions) {
    await db.delete(workflowActions).where(eq(workflowActions.workflowId, id));
    if (body.actions.length) {
      await db.insert(workflowActions).values(
        body.actions.map((action) => ({ workflowId: id, type: action.type, config: action.config as never, sortOrder: action.sortOrder })),
      );
    }
  }

  await recordAudit({ action: "config.workflow.updated", resourceType: "workflow", resourceId: id, summary: `Updated workflow ${existing.name}` });
  return ok(updated);
});

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  assertCan(context, "admin.workflows.manage");
  const id = await param(context.segment, "id" as never);
  const [existing] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  if (!existing) throw AppError.notFound("This workflow does not exist.");
  await db.delete(workflows).where(eq(workflows.id, id));
  await recordAudit({ action: "config.workflow.deleted", resourceType: "workflow", resourceId: id, summary: `Deleted workflow ${existing.name}` });
  return ok({ id });
});

export const GET = authRoute<{ id: string }>(async (_request, context) => {
  assertCan(context, "admin.workflows.manage");
  const id = await param(context.segment, "id" as never);
  const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  if (!workflow) throw AppError.notFound("This workflow does not exist.");
  const [conditions, actions] = await Promise.all([
    db.select().from(workflowConditions).where(eq(workflowConditions.workflowId, id)).orderBy(asc(workflowConditions.sortOrder)),
    db.select().from(workflowActions).where(eq(workflowActions.workflowId, id)).orderBy(asc(workflowActions.sortOrder)),
  ]);
  return ok({ ...workflow, conditions, actions });
});

