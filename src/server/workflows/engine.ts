import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tasks, workflowActions, workflowConditions, workflowRuns, workflows } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { getOptionalContext } from "@/server/context";
import { recordAudit, recordTimeline } from "@/server/audit/audit";
import { notificationService } from "@/server/notifications/service";
import { getUserIdsWithPermission } from "@/server/permissions/service";
import { getStatuses } from "@/server/configuration/service";
import { nextReference, REFERENCE_PREFIXES } from "@/server/services/reference";

import { getRecordAdapter, readRecordStatus, writeRecordStatus } from "./records";

export type WorkflowTrigger =
  | "RECORD_CREATED"
  | "RECORD_UPDATED"
  | "STATUS_CHANGED"
  | "FORM_SUBMITTED"
  | "REPORT_SUBMITTED"
  | "USER_ASSIGNED";

export type WorkflowRunInput = {
  trigger: WorkflowTrigger;
  resourceType: string;
  recordId: string;
  context?: Record<string, unknown>;
};

export type ConditionOperator = "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "GREATER_THAN" | "LESS_THAN" | "EXISTS" | "IN";

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

function resolvePath(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, context);
}

export function evaluateCondition(operator: string, left: unknown, right: string | null): boolean {
  const target = right ?? "";
  switch (operator as ConditionOperator) {
    case "EQUALS":
      return String(left ?? "") === target;
    case "NOT_EQUALS":
      return String(left ?? "") !== target;
    case "CONTAINS":
      return String(left ?? "").toLowerCase().includes(target.toLowerCase());
    case "GREATER_THAN":
      return Number(left) > Number(target);
    case "LESS_THAN":
      return Number(left) < Number(target);
    case "EXISTS":
      return left !== undefined && left !== null && left !== "";
    case "IN":
      return target
        .split(",")
        .map((value) => value.trim())
        .includes(String(left ?? ""));
    default:
      return false;
  }
}

/** Applies AND/OR conjunction groups in order of `sortOrder`. */
export function evaluateConditions(
  conditions: Array<{ field: string; operator: string; value: string | null; conjunction: string; sortOrder: number }>,
  context: Record<string, unknown>,
): boolean {
  if (conditions.length === 0) return true;
  const ordered = [...conditions].sort((a, b) => a.sortOrder - b.sortOrder);
  let result = evaluateCondition(ordered[0]!.operator, resolvePath(context, ordered[0]!.field), ordered[0]!.value);
  for (let index = 1; index < ordered.length; index += 1) {
    const condition = ordered[index]!;
    const value = evaluateCondition(condition.operator, resolvePath(context, condition.field), condition.value);
    result = condition.conjunction === "OR" ? result || value : result && value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type ActionConfig = Record<string, unknown>;

async function executeAction(
  action: { type: string; config: ActionConfig },
  input: { resourceType: string; recordId: string; context: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const { resourceType, recordId } = input;
  const ctx = getOptionalContext();

  switch (action.type) {
    case "CHANGE_STATUS": {
      const status = String(action.config.status ?? "");
      if (!status) return { skipped: "No status configured." };
      const allowed = await getStatuses(resourceType);
      if (!allowed.some((option) => option.key === status)) {
        return { skipped: `Status "${status}" is not configured for ${resourceType}.` };
      }
      const applied = await writeRecordStatus(resourceType, recordId, status);
      if (applied) {
        await recordTimeline({ recordType: resourceType, recordId, type: "WORKFLOW", message: `Workflow set status to ${status}` });
      }
      return { status, applied };
    }
    case "ASSIGN_USER": {
      const userId = String(action.config.userId ?? "");
      if (!userId) return { skipped: "No user configured." };
      if (resourceType === "task") {
        await db.update(tasks).set({ assigneeId: userId }).where(eq(tasks.id, recordId));
      } else if (resourceType === "incident") {
        const { incidentAssignments } = await import("@/lib/db/schema");
        await db.insert(incidentAssignments).values({ incidentId: recordId, userId, role: String(action.config.role ?? "ASSIGNED") });
      }
      await recordTimeline({ recordType: resourceType, recordId, type: "WORKFLOW", message: "Workflow assigned an owner" });
      if (userId !== ctx?.user.id) {
        await notificationService.send({
          userId,
          type: "WORKFLOW",
          category: "ASSIGNMENTS",
          title: "Record assigned to you",
          message: `A workflow assigned you to a ${resourceType} record.`,
          resourceType,
          resourceId: recordId,
        });
      }
      return { userId };
    }
    case "ASSIGN_DEPARTMENT": {
      const departmentId = String(action.config.departmentId ?? "");
      if (!departmentId) return { skipped: "No department configured." };
      const adapter = getRecordAdapter(resourceType);
      if (adapter && "departmentId" in adapter.table) {
        await db.update(adapter.table).set({ departmentId } as never).where(eq(adapter.idColumn, recordId));
      }
      await recordTimeline({ recordType: resourceType, recordId, type: "WORKFLOW", message: "Workflow assigned a department" });
      return { departmentId };
    }
    case "CREATE_TASK": {
      const title = String(action.config.title ?? "Follow up required");
      const dueInDays = Number(action.config.dueInDays ?? 3);
      const reference = await nextReference(tasks, REFERENCE_PREFIXES.task);
      const dueAt = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);
      const [task] = await db
        .insert(tasks)
        .values({
          reference,
          title,
          description: String(action.config.description ?? ""),
          status: "OPEN",
          priority: String(action.config.priority ?? "MEDIUM"),
          assigneeId: (action.config.assigneeId as string) ?? null,
          creatorId: ctx?.user.id ?? null,
          dueAt,
          recordType: resourceType,
          recordId,
        })
        .returning();
      await recordTimeline({ recordType: resourceType, recordId, type: "WORKFLOW", message: `Workflow created task ${reference}` });
      if (task?.assigneeId && task.assigneeId !== ctx?.user.id) {
        await notificationService.send({
          userId: task.assigneeId,
          type: "TASK",
          category: "TASKS",
          title: "New task assigned",
          message: title,
          resourceType: "task",
          resourceId: task.id,
        });
      }
      return { taskId: task?.id ?? null, reference };
    }
    case "SEND_NOTIFICATION": {
      const title = String(action.config.title ?? "Workflow notification");
      const message = String(action.config.message ?? "");
      const permission = action.config.permission ? String(action.config.permission) : null;
      const userId = action.config.userId ? String(action.config.userId) : null;
      if (userId) {
        await notificationService.send({ userId, type: "WORKFLOW", category: "WORKFLOWS", title, message, resourceType, resourceId: recordId });
        return { notified: 1 };
      }
      if (permission) {
        const sent = await notificationService.notifyPermission(permission, { type: "WORKFLOW", category: "WORKFLOWS", title, message, resourceType, resourceId: recordId });
        return { notified: sent };
      }
      return { skipped: "No recipient configured." };
    }
    case "CREATE_TIMELINE_EVENT": {
      const message = String(action.config.message ?? "Workflow event");
      await recordTimeline({ recordType: resourceType, recordId, type: String(action.config.eventType ?? "WORKFLOW"), message });
      return { message };
    }
    case "REQUIRE_APPROVAL": {
      const permission = String(action.config.permission ?? "reports.approve");
      const title = String(action.config.title ?? "Approval required");
      const reference = await nextReference(tasks, REFERENCE_PREFIXES.task);
      const [task] = await db
        .insert(tasks)
        .values({
          reference,
          title,
          description: String(action.config.description ?? "A workflow requires approval."),
          status: "OPEN",
          priority: "HIGH",
          creatorId: ctx?.user.id ?? null,
          dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          recordType: resourceType,
          recordId,
        })
        .returning();
      const approvers = await getUserIdsWithPermission(permission);
      await notificationService.sendToMany(approvers, {
        type: "APPROVAL",
        category: "APPROVALS",
        title,
        message: String(action.config.message ?? `A ${resourceType} record requires approval.`),
        resourceType,
        resourceId: recordId,
        priority: "HIGH",
      });
      await recordTimeline({ recordType: resourceType, recordId, type: "WORKFLOW", message: `Approval requested (${title})` });
      return { taskId: task?.id ?? null, approvers: approvers.length };
    }
    default:
      return { skipped: `Unknown action "${action.type}".` };
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Executes every enabled workflow matching a trigger.
 * Workflow failures are isolated: one broken workflow cannot abort the
 * operation that triggered it.
 */
export async function runWorkflows(input: WorkflowRunInput): Promise<{ executed: number; results: unknown[] }> {
  const { trigger, resourceType, recordId } = input;
  let candidates: Array<typeof workflows.$inferSelect> = [];
  try {
    candidates = await db
      .select()
      .from(workflows)
      .where(eq(workflows.enabled, true));
  } catch (error) {
    logger.warn("Workflow lookup failed", { error: (error as Error).message });
    return { executed: 0, results: [] };
  }

  const matching = candidates.filter((workflow) => workflow.resourceType === resourceType && workflow.trigger === trigger);
  if (matching.length === 0) return { executed: 0, results: [] };

  const current = await readRecordStatus(resourceType, recordId);
  const context: Record<string, unknown> = {
    ...input.context,
    resourceType,
    recordId,
    status: input.context?.status ?? current.status,
    reference: current.reference,
  };

  const results: unknown[] = [];
  for (const workflow of matching) {
    const startedAt = new Date();
    try {
      const [conditions, actions] = await Promise.all([
        db.select().from(workflowConditions).where(eq(workflowConditions.workflowId, workflow.id)).orderBy(asc(workflowConditions.sortOrder)),
        db.select().from(workflowActions).where(eq(workflowActions.workflowId, workflow.id)).orderBy(asc(workflowActions.sortOrder)),
      ]);

      if (!evaluateConditions(conditions, context)) {
        results.push({ workflow: workflow.key, skipped: "conditions-not-met" });
        continue;
      }

      const actionResults: Array<Record<string, unknown>> = [];
      for (const action of actions) {
        actionResults.push({ type: action.type, ...(await executeAction({ type: action.type, config: (action.config ?? {}) as ActionConfig }, { resourceType, recordId, context })) });
      }

      await db.insert(workflowRuns).values({
        workflowId: workflow.id,
        resourceType,
        resourceId: recordId,
        trigger,
        status: "SUCCESS",
        result: actionResults as never,
        startedAt,
        completedAt: new Date(),
      });
      await recordAudit({
        action: "workflow.executed",
        resourceType,
        resourceId: recordId,
        summary: `Workflow "${workflow.name}" executed`,
        metadata: { trigger, actions: actionResults },
      });
      results.push({ workflow: workflow.key, actions: actionResults });
    } catch (error) {
      logger.error("Workflow execution failed", { workflow: workflow.key, error: (error as Error).message });
      await db.insert(workflowRuns).values({
        workflowId: workflow.id,
        resourceType,
        resourceId: recordId,
        trigger,
        status: "FAILED",
        error: (error as Error).message,
        startedAt,
        completedAt: new Date(),
      });
      results.push({ workflow: workflow.key, error: (error as Error).message });
    }
  }

  return { executed: matching.length, results };
}

export const workflowEngine = { runWorkflows, evaluateConditions, evaluateCondition };
