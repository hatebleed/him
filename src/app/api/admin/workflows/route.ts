import { z } from "zod";

import { db } from "@/lib/db/client";
import { workflowActions, workflowConditions, workflows } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { authRoute, ok } from "@/server/api/handler";
import { assertCan } from "@/server/context";
import { recordAudit } from "@/server/audit/audit";

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.string().default("EQUALS"),
  value: z.string().nullish(),
  conjunction: z.string().default("AND"),
  sortOrder: z.number().default(0),
});

const actionSchema = z.object({
  type: z.string().min(1),
  config: z.record(z.unknown()).default({}),
  sortOrder: z.number().default(0),
});

const createSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  description: z.string().nullish(),
  resourceType: z.string().min(1),
  trigger: z.string().default("RECORD_CREATED"),
  enabled: z.boolean().default(true),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).default([]),
});

/** GET /api/admin/workflows - definitions with their conditions and actions. */
export const GET = authRoute(async (_request, context) => {
  assertCan(context, "admin.workflows.manage");
  const rows = await db.select().from(workflows).orderBy(asc(workflows.sortOrder), asc(workflows.name));
  const withDetails = await Promise.all(
    rows.map(async (workflow) => {
      const [conditions, actions] = await Promise.all([
        db.select().from(workflowConditions).where(eq(workflowConditions.workflowId, workflow.id)).orderBy(asc(workflowConditions.sortOrder)),
        db.select().from(workflowActions).where(eq(workflowActions.workflowId, workflow.id)).orderBy(asc(workflowActions.sortOrder)),
      ]);
      return { ...workflow, conditions, actions };
    }),
  );
  return ok({ rows: withDetails });
});

export const POST = authRoute(async (request, context) => {
  assertCan(context, "admin.workflows.manage");
  const body = createSchema.parse(await request.json().catch(() => ({})));
  const [workflow] = await db
    .insert(workflows)
    .values({
      key: body.key.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      name: body.name,
      description: body.description ?? null,
      resourceType: body.resourceType,
      trigger: body.trigger,
      enabled: body.enabled,
      createdById: context.user.id,
    })
    .returning();

  if (body.conditions.length) {
    await db.insert(workflowConditions).values(
      body.conditions.map((condition) => ({
        workflowId: workflow!.id,
        field: condition.field,
        operator: condition.operator,
        value: condition.value ?? null,
        conjunction: condition.conjunction,
        sortOrder: condition.sortOrder,
      })),
    );
  }
  if (body.actions.length) {
    await db.insert(workflowActions).values(
      body.actions.map((action) => ({ workflowId: workflow!.id, type: action.type, config: action.config as never, sortOrder: action.sortOrder })),
    );
  }

  await recordAudit({ action: "config.workflow.created", resourceType: "workflow", resourceId: workflow!.id, summary: `Created workflow ${body.name}` });
  return ok(workflow, undefined, 201);
});
