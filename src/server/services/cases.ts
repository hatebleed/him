import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { caseIncidents, cases, departments, incidents, reports, tasks, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { CaseUpsertInput } from "@/lib/validation/operations";

import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { getClosedStatuses } from "../configuration/service";
import { readCustomValues, readCustomValuesForRecord, writeCustomValues } from "./custom-fields";
import { combine, multi, orderByDirection, single, type ListParams } from "./pagination";
import { nextReference, REFERENCE_PREFIXES } from "./reference";

const sortColumns = {
  reference: cases.reference,
  title: cases.title,
  status: cases.status,
  priority: cases.priority,
  openedAt: cases.openedAt,
  createdAt: cases.createdAt,
} as const;

export const caseService = {
  async list(ctx: RequestContext, params: ListParams) {
    assertCan(ctx, "cases.view");
    const conditions: SQL[] = [isNull(cases.deletedAt)];
    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(ilike(cases.reference, term), ilike(cases.title, term), ilike(cases.description, term));
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(cases.status, statuses));
    const priorities = multi(params.filters.priority);
    if (priorities.length) conditions.push(inArray(cases.priority, priorities));
    const lead = single(params.filters.lead);
    if (lead === "me") conditions.push(eq(cases.leadId, ctx.user.id));
    else if (lead) conditions.push(eq(cases.leadId, lead));
    const department = single(params.filters.department);
    if (department) conditions.push(eq(cases.departmentId, department));

    const where = combine(...conditions);
    const sortColumn = sortColumns[(params.sort ?? "createdAt") as keyof typeof sortColumns] ?? cases.createdAt;

    const rows = await db
      .select({
        id: cases.id,
        reference: cases.reference,
        title: cases.title,
        status: cases.status,
        priority: cases.priority,
        leadId: cases.leadId,
        leadName: users.name,
        departmentId: cases.departmentId,
        departmentName: departments.name,
        openedAt: cases.openedAt,
        closedAt: cases.closedAt,
        createdAt: cases.createdAt,
      })
      .from(cases)
      .leftJoin(users, eq(users.id, cases.leadId))
      .leftJoin(departments, eq(departments.id, cases.departmentId))
      .where(where)
      .orderBy(orderByDirection(sortColumn, params.dir))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(cases).where(where);
    const ids = rows.map((row) => row.id);
    const customValues = await readCustomValues("case", ids);

    const counts = ids.length
      ? await db
          .select({ caseId: caseIncidents.caseId, value: count() })
          .from(caseIncidents)
          .where(inArray(caseIncidents.caseId, ids))
          .groupBy(caseIncidents.caseId)
      : [];
    const countByCase = new Map(counts.map((row) => [row.caseId, Number(row.value)] as const));

    return {
      rows: rows.map((row) => ({ ...row, incidentCount: countByCase.get(row.id) ?? 0, customFields: customValues.get(row.id) ?? {} })),
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "cases.view");
    const [record] = await db
      .select({
        id: cases.id,
        reference: cases.reference,
        title: cases.title,
        description: cases.description,
        status: cases.status,
        priority: cases.priority,
        categoryId: cases.categoryId,
        departmentId: cases.departmentId,
        departmentName: departments.name,
        leadId: cases.leadId,
        leadName: users.name,
        openedAt: cases.openedAt,
        closedAt: cases.closedAt,
        reviewNotes: cases.reviewNotes,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
      })
      .from(cases)
      .leftJoin(departments, eq(departments.id, cases.departmentId))
      .leftJoin(users, eq(users.id, cases.leadId))
      .where(and(eq(cases.id, id), isNull(cases.deletedAt)))
      .limit(1);

    if (!record) throw AppError.notFound("This case does not exist.");

    const [linkedIncidents, caseReports, caseTasks, customFields] = await Promise.all([
      db
        .select({
          id: caseIncidents.id,
          incidentId: incidents.id,
          reference: incidents.reference,
          title: incidents.title,
          status: incidents.status,
          priority: incidents.priority,
          reportedAt: incidents.reportedAt,
        })
        .from(caseIncidents)
        .innerJoin(incidents, eq(incidents.id, caseIncidents.incidentId))
        .where(eq(caseIncidents.caseId, id))
        .orderBy(desc(incidents.reportedAt)),
      db
        .select({ id: reports.id, reference: reports.reference, title: reports.title, status: reports.status, createdAt: reports.createdAt })
        .from(reports)
        .where(eq(reports.caseId, id))
        .orderBy(desc(reports.createdAt))
        .limit(50),
      db
        .select({ id: tasks.id, reference: tasks.reference, title: tasks.title, status: tasks.status, priority: tasks.priority, dueAt: tasks.dueAt })
        .from(tasks)
        .where(and(eq(tasks.recordType, "case"), eq(tasks.recordId, id), isNull(tasks.deletedAt)))
        .orderBy(desc(tasks.createdAt))
        .limit(50),
      readCustomValuesForRecord("case", id),
    ]);

    return { ...record, incidents: linkedIncidents, reports: caseReports, tasks: caseTasks, customFields };
  },

  async create(ctx: RequestContext, input: CaseUpsertInput) {
    assertCan(ctx, "cases.create");
    const reference = await nextReference(cases, REFERENCE_PREFIXES.case);
    const [created] = await db
      .insert(cases)
      .values({
        reference,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        leadId: input.leadId,
        openedAt: input.openedAt ?? new Date(),
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning();

    if (input.incidentIds.length) {
      await db
        .insert(caseIncidents)
        .values(input.incidentIds.map((incidentId) => ({ caseId: created!.id, incidentId })))
        .onConflictDoNothing();
      for (const incidentId of input.incidentIds) {
        await recordTimeline({ recordType: "incident", recordId: incidentId, type: "RELATIONSHIP", message: `Added to case ${reference}` });
      }
    }

    if (input.customFields) await writeCustomValues("case", created!.id, input.customFields);
    await recordAudit({ action: "case.created", resourceType: "case", resourceId: created!.id, summary: `Created case ${reference}`, newValue: { title: created!.title } });
    await recordTimeline({ recordType: "case", recordId: created!.id, type: "CREATED", message: `Case created by ${ctx.user.name}` });
    return created;
  },

  /** Creates a case from an existing incident, copying key context across. */
  async createFromIncident(ctx: RequestContext, incidentId: string) {
    assertCan(ctx, "cases.create");
    const [incident] = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    if (!incident) throw AppError.notFound("This incident does not exist.");

    const created = await this.create(ctx, {
      title: incident.title,
      description: incident.description ?? null,
      status: "OPEN",
      priority: incident.priority,
      categoryId: incident.categoryId,
      departmentId: incident.departmentId,
      leadId: incident.supervisorId,
      openedAt: null,
      incidentIds: [incidentId],
    });

    await recordTimeline({
      recordType: "incident",
      recordId: incidentId,
      type: "RELATIONSHIP",
      message: `Converted into case ${created!.reference}`,
    });
    return created;
  },

  async update(ctx: RequestContext, id: string, input: CaseUpsertInput) {
    assertCan(ctx, "cases.edit");
    const [existing] = await db.select().from(cases).where(and(eq(cases.id, id), isNull(cases.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This case does not exist.");

    const closed = await getClosedStatuses("case");
    const [updated] = await db
      .update(cases)
      .set({
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        leadId: input.leadId,
        closedAt: closed.includes(input.status) && !existing.closedAt ? new Date() : closed.includes(input.status) ? existing.closedAt : null,
        updatedById: ctx.user.id,
      })
      .where(eq(cases.id, id))
      .returning();

    await db.delete(caseIncidents).where(eq(caseIncidents.caseId, id));
    if (input.incidentIds.length) {
      await db.insert(caseIncidents).values(input.incidentIds.map((incidentId) => ({ caseId: id, incidentId }))).onConflictDoNothing();
    }

    if (input.customFields) await writeCustomValues("case", id, input.customFields);
    if (existing.status !== input.status) {
      await recordTimeline({ recordType: "case", recordId: id, type: "STATUS", message: `Status changed from ${existing.status} to ${input.status}` });
    }
    await recordAudit({
      action: "case.updated",
      resourceType: "case",
      resourceId: id,
      summary: `Updated case ${existing.reference}`,
      previousValue: { status: existing.status },
      newValue: { status: input.status },
    });
    return updated;
  },

  async review(ctx: RequestContext, id: string, status: string, reviewNotes?: string | null) {
    assertCan(ctx, "cases.close");
    const [existing] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This case does not exist.");
    const closed = await getClosedStatuses("case");

    const [updated] = await db
      .update(cases)
      .set({
        status,
        reviewNotes: reviewNotes ?? existing.reviewNotes,
        closedAt: closed.includes(status) && !existing.closedAt ? new Date() : existing.closedAt,
        updatedById: ctx.user.id,
      })
      .where(eq(cases.id, id))
      .returning();

    await recordTimeline({ recordType: "case", recordId: id, type: "REVIEW", message: `Reviewed by ${ctx.user.name}${reviewNotes ? ` - ${reviewNotes}` : ""}` });
    await recordAudit({
      action: "case.reviewed",
      resourceType: "case",
      resourceId: id,
      summary: `Case ${existing.reference} reviewed (${status})`,
      previousValue: { status: existing.status },
      newValue: { status, reviewNotes },
    });
    return updated;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "cases.delete");
    const [existing] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This case does not exist.");
    await db.update(cases).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(cases.id, id));
    await recordAudit({ action: "case.deleted", resourceType: "case", resourceId: id, summary: `Deleted case ${existing.reference}` });
    return { id };
  },
};
