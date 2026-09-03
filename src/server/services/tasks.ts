import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { taskComments, tasks, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { TaskUpsertInput } from "@/lib/validation/records";

import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { getClosedStatuses } from "../configuration/service";
import { notificationService } from "../notifications/service";
import { readCustomValues, readCustomValuesForRecord, writeCustomValues } from "./custom-fields";
import { combine, multi, orderByDirection, single, type ListParams } from "./pagination";
import { nextReference, REFERENCE_PREFIXES } from "./reference";

const sortColumns = {
  title: tasks.title,
  status: tasks.status,
  priority: tasks.priority,
  dueAt: tasks.dueAt,
  createdAt: tasks.createdAt,
} as const;

export const taskService = {
  async list(ctx: RequestContext, params: ListParams) {
    assertCan(ctx, "tasks.view");
    const conditions: SQL[] = [isNull(tasks.deletedAt)];

    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(ilike(tasks.title, term), ilike(tasks.reference, term), ilike(tasks.description, term));
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(tasks.status, statuses));
    const priorities = multi(params.filters.priority);
    if (priorities.length) conditions.push(inArray(tasks.priority, priorities));
    const assignee = single(params.filters.assignee);
    if (assignee === "me") conditions.push(eq(tasks.assigneeId, ctx.user.id));
    else if (assignee) conditions.push(eq(tasks.assigneeId, assignee));
    const recordType = single(params.filters.recordType);
    const recordId = single(params.filters.recordId);
    if (recordType && recordId) conditions.push(and(eq(tasks.recordType, recordType), eq(tasks.recordId, recordId))!);
    if (params.filters.overdue === "true") conditions.push(iltDue());

    const where = combine(...conditions);
    const sortColumn = sortColumns[(params.sort ?? "createdAt") as keyof typeof sortColumns] ?? tasks.createdAt;

    const rows = await db
      .select({
        id: tasks.id,
        reference: tasks.reference,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        assigneeId: tasks.assigneeId,
        assigneeName: users.name,
        creatorId: tasks.creatorId,
        recordType: tasks.recordType,
        recordId: tasks.recordId,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(where)
      .orderBy(orderByDirection(sortColumn, params.dir))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(tasks).where(where);
    const customValues = await readCustomValues("task", rows.map((row) => row.id));

    return {
      rows: rows.map((row) => ({ ...row, customFields: customValues.get(row.id) ?? {} })),
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "tasks.view");
    const [task] = await db
      .select({
        id: tasks.id,
        reference: tasks.reference,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        assigneeId: tasks.assigneeId,
        assigneeName: users.name,
        creatorId: tasks.creatorId,
        recordType: tasks.recordType,
        recordId: tasks.recordId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) throw AppError.notFound("This task does not exist.");

    const [comments, customFields] = await Promise.all([
      db
        .select({
          id: taskComments.id,
          body: taskComments.body,
          createdAt: taskComments.createdAt,
          authorId: taskComments.authorId,
          authorName: users.name,
        })
        .from(taskComments)
        .leftJoin(users, eq(users.id, taskComments.authorId))
        .where(eq(taskComments.taskId, id))
        .orderBy(desc(taskComments.createdAt)),
      readCustomValuesForRecord("task", id),
    ]);

    return { ...task, comments, customFields };
  },

  async create(ctx: RequestContext, input: TaskUpsertInput) {
    assertCan(ctx, "tasks.create");
    const reference = await nextReference(tasks, REFERENCE_PREFIXES.task);
    const [created] = await db
      .insert(tasks)
      .values({
        reference,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        creatorId: ctx.user.id,
        departmentId: input.departmentId,
        dueAt: input.dueAt,
        recordType: input.recordType,
        recordId: input.recordId,
      })
      .returning();

    if (!created) throw AppError.badRequest("The task could not be created.");
    if (input.customFields) await writeCustomValues("task", created.id, input.customFields);

    await recordAudit({ action: "task.created", resourceType: "task", resourceId: created.id, summary: `Created task ${created.reference}`, newValue: { title: created.title } });
    await recordTimeline({ recordType: "task", recordId: created.id, type: "CREATED", message: `Task created by ${ctx.user.name}` });
    if (created.recordType && created.recordId) {
      await recordTimeline({ recordType: created.recordType, recordId: created.recordId, type: "TASK", message: `Task ${created.reference} created` });
    }
    if (created.assigneeId && created.assigneeId !== ctx.user.id) {
      await notificationService.send({
        userId: created.assigneeId,
        type: "TASK",
        category: "TASKS",
        title: "New task assigned to you",
        message: created.title,
        resourceType: "task",
        resourceId: created.id,
      });
    }
    return created;
  },

  async update(ctx: RequestContext, id: string, input: TaskUpsertInput) {
    assertCan(ctx, "tasks.edit");
    const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This task does not exist.");

    const closed = await getClosedStatuses("task");
    const nowCompleted = closed.includes(input.status) && existing.completedAt === null;

    const [updated] = await db
      .update(tasks)
      .set({
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        departmentId: input.departmentId,
        dueAt: input.dueAt,
        completedAt: nowCompleted ? new Date() : closed.includes(input.status) ? existing.completedAt : null,
        updatedById: ctx.user.id,
      })
      .where(eq(tasks.id, id))
      .returning();

    if (input.customFields) await writeCustomValues("task", id, input.customFields);

    if (existing.status !== input.status) {
      await recordTimeline({ recordType: "task", recordId: id, type: "STATUS", message: `Status changed from ${existing.status} to ${input.status}` });
    }
    await recordAudit({
      action: "task.updated",
      resourceType: "task",
      resourceId: id,
      summary: `Updated task ${existing.reference}`,
      previousValue: { status: existing.status, assigneeId: existing.assigneeId },
      newValue: { status: input.status, assigneeId: input.assigneeId },
    });

    if (input.assigneeId && input.assigneeId !== existing.assigneeId && input.assigneeId !== ctx.user.id) {
      await notificationService.send({
        userId: input.assigneeId,
        type: "TASK",
        category: "TASKS",
        title: "Task assigned to you",
        message: input.title,
        resourceType: "task",
        resourceId: id,
      });
    }
    return updated;
  },

  async addComment(ctx: RequestContext, id: string, body: string) {
    assertCan(ctx, "tasks.view");
    const [task] = await db.select({ id: tasks.id, reference: tasks.reference }).from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!task) throw AppError.notFound("This task does not exist.");
    const [comment] = await db.insert(taskComments).values({ taskId: id, authorId: ctx.user.id, body }).returning();
    await recordTimeline({ recordType: "task", recordId: id, type: "COMMENT", message: `${ctx.user.name} commented` });
    return comment;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "tasks.delete");
    const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This task does not exist.");
    await db.update(tasks).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(tasks.id, id));
    await recordAudit({ action: "task.deleted", resourceType: "task", resourceId: id, summary: `Deleted task ${existing.reference}` });
    return { id };
  },

  /** Tasks for the current user, used by the dashboard widget and command palette. */
  async mine(ctx: RequestContext, limit = 8) {
    assertCan(ctx, "tasks.view");
    const closed = await getClosedStatuses("task");
    return db
      .select({ id: tasks.id, reference: tasks.reference, title: tasks.title, status: tasks.status, priority: tasks.priority, dueAt: tasks.dueAt })
      .from(tasks)
      .where(and(eq(tasks.assigneeId, ctx.user.id), isNull(tasks.deletedAt), closed.length ? notInStatus(closed) : undefined))
      .orderBy(asc(tasks.dueAt))
      .limit(limit);
  },
};

function iltDue(): SQL {
  return sql`${tasks.dueAt} is not null and ${tasks.dueAt} < now() and ${tasks.completedAt} is null` as SQL;
}

function notInStatus(closed: string[]): SQL {
  return notInArray(tasks.status, closed);
}
