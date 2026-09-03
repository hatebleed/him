import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { calls, departments, incidents } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { CallUpsertInput } from "@/lib/validation/operations";

import { publish } from "@/lib/realtime/bus";
import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { dispatchProvider } from "../dispatch/provider";
import { combine, multi, single, type ListParams } from "./pagination";
import { nextReference, REFERENCE_PREFIXES } from "./reference";

export const callService = {
  async list(ctx: RequestContext, params: ListParams) {
    assertCan(ctx, "calls.view");
    const conditions: SQL[] = [];
    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(
        ilike(calls.reference, term),
        ilike(calls.description, term),
        ilike(calls.location, term),
        ilike(calls.callerName, term),
      );
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(calls.status, statuses));
    if (params.filters.active === "true") conditions.push(inArray(calls.status, ["PENDING", "DISPATCHED", "ON_SCENE"]));
    const priorities = multi(params.filters.priority);
    if (priorities.length) conditions.push(inArray(calls.priority, priorities));
    const department = single(params.filters.department);
    if (department) conditions.push(eq(calls.departmentId, department));

    const where = combine(...conditions);
    const rows = await db
      .select({
        id: calls.id,
        reference: calls.reference,
        type: calls.type,
        priority: calls.priority,
        status: calls.status,
        description: calls.description,
        location: calls.location,
        callerName: calls.callerName,
        receivedAt: calls.receivedAt,
        dispatchedAt: calls.dispatchedAt,
        closedAt: calls.closedAt,
        incidentId: calls.incidentId,
        incidentReference: incidents.reference,
        departmentId: calls.departmentId,
        departmentName: departments.name,
      })
      .from(calls)
      .leftJoin(incidents, eq(incidents.id, calls.incidentId))
      .leftJoin(departments, eq(departments.id, calls.departmentId))
      .where(where)
      .orderBy(desc(calls.receivedAt))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(calls).where(where);
    const ids = rows.map((row) => row.id);
    const detailed = ids.length ? await dispatchProvider.getCalls(200) : [];
    const byId = new Map(detailed.map((call) => [call.id, call] as const));

    return {
      rows: rows.map((row) => ({ ...row, units: byId.get(row.id)?.units ?? [] })),
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "calls.view");
    const call = await dispatchProvider.getCall(id);
    if (!call) throw AppError.notFound("This call does not exist.");
    return call;
  },

  async create(ctx: RequestContext, input: CallUpsertInput) {
    assertCan(ctx, "calls.create");
    const reference = await nextReference(calls, REFERENCE_PREFIXES.call);
    const [created] = await db
      .insert(calls)
      .values({
        reference,
        type: input.type,
        priority: input.priority,
        status: input.status,
        description: input.description,
        location: input.location,
        callerName: input.callerName,
        callerPhone: input.callerPhone,
        departmentId: input.departmentId,
        incidentId: input.incidentId,
        receivedById: ctx.user.id,
      })
      .returning();

    publish({ type: "call.created", payload: { id: created!.id, reference, priority: input.priority } });
    await recordAudit({ action: "call.created", resourceType: "call", resourceId: created!.id, summary: `Created call ${reference}` });
    await recordTimeline({ recordType: "call", recordId: created!.id, type: "CREATED", message: `Call received by ${ctx.user.name}` });
    return created;
  },

  async update(ctx: RequestContext, id: string, input: CallUpsertInput) {
    assertCan(ctx, "calls.edit");
    const [existing] = await db.select().from(calls).where(eq(calls.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This call does not exist.");

    const [updated] = await db
      .update(calls)
      .set({
        type: input.type,
        priority: input.priority,
        status: input.status,
        description: input.description,
        location: input.location,
        callerName: input.callerName,
        callerPhone: input.callerPhone,
        departmentId: input.departmentId,
        incidentId: input.incidentId,
        closedAt: ["CLOSED", "CANCELLED"].includes(input.status) && !existing.closedAt ? new Date() : existing.closedAt,
      })
      .where(eq(calls.id, id))
      .returning();

    publish({ type: "call.updated", payload: { id, reference: existing.reference, status: input.status } });
    await recordAudit({
      action: "call.updated",
      resourceType: "call",
      resourceId: id,
      summary: `Updated call ${existing.reference}`,
      previousValue: { status: existing.status },
      newValue: { status: input.status },
    });
    return updated;
  },

  async assignUnit(ctx: RequestContext, callId: string, unitId: string) {
    assertCan(ctx, "dispatch.manage");
    const updated = await dispatchProvider.assignUnit(callId, unitId);
    await recordTimeline({ recordType: "call", recordId: callId, type: "ASSIGNMENT", message: "Unit assigned to call" });
    await recordAudit({ action: "call.unit.assigned", resourceType: "call", resourceId: callId, summary: "Unit assigned", newValue: { unitId } });
    return updated;
  },

  async unassignUnit(ctx: RequestContext, callId: string, unitId: string) {
    assertCan(ctx, "dispatch.manage");
    const updated = await dispatchProvider.unassignUnit(callId, unitId);
    await recordAudit({ action: "call.unit.unassigned", resourceType: "call", resourceId: callId, summary: "Unit removed", newValue: { unitId } });
    return updated;
  },

  async setUnitStatus(ctx: RequestContext, callId: string, unitId: string, status: string) {
    assertCan(ctx, "dispatch.manage");
    const updated = await dispatchProvider.updateCallUnitStatus(callId, unitId, status);
    await recordTimeline({ recordType: "call", recordId: callId, type: "STATUS", message: `Unit status updated to ${status}` });
    return updated;
  },

  /** Creates an incident from a call, carrying details and assignments over. */
  async escalate(ctx: RequestContext, callId: string) {
    assertCan(ctx, "incidents.create");
    const call = await dispatchProvider.getCall(callId);
    if (!call) throw AppError.notFound("This call does not exist.");
    if (call.incidentId) throw AppError.conflict("This call has already been escalated to an incident.");

    const { incidents } = await import("@/lib/db/schema");
    const reference = await nextReference(incidents, REFERENCE_PREFIXES.incident);
    const [incident] = await db
      .insert(incidents)
      .values({
        reference,
        title: call.description ? call.description.slice(0, 180) : `Call ${call.reference}`,
        description: call.description,
        priority: call.priority,
        status: "NEW",
        location: call.location,
        departmentId: call.departmentId,
        reportedAt: call.receivedAt,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning();

    await db.update(calls).set({ incidentId: incident!.id, status: "DISPATCHED", dispatchedAt: call.dispatchedAt ?? new Date() }).where(eq(calls.id, callId));

    for (const unit of call.units) {
      const { incidentAssignments } = await import("@/lib/db/schema");
      await db.insert(incidentAssignments).values({ incidentId: incident!.id, unitId: unit.id, role: "ASSIGNED" }).onConflictDoNothing();
    }

    await recordTimeline({ recordType: "call", recordId: callId, type: "RELATIONSHIP", message: `Escalated to incident ${reference}` });
    await recordTimeline({ recordType: "incident", recordId: incident!.id, type: "CREATED", message: `Created from call ${call.reference}` });
    await recordAudit({ action: "call.escalated", resourceType: "call", resourceId: callId, summary: `Escalated to incident ${reference}`, newValue: { incidentId: incident!.id } });
    return incident;
  },

  async activeCalls(ctx: RequestContext) {
    assertCan(ctx, "calls.view");
    return dispatchProvider.getActiveCalls();
  },
};

export { and, isNull };
