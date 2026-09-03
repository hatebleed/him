import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { callUnits, calls, departments, unitMembers, units, users, vehicles } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { UnitUpsertInput } from "@/lib/validation/operations";

import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { publish } from "@/lib/realtime/bus";
import { combine, multi, single, type ListParams } from "./pagination";

export const unitService = {
  async list(ctx: RequestContext, params: ListParams) {
    assertCan(ctx, "units.view");
    const conditions: SQL[] = [isNull(units.deletedAt)];
    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(ilike(units.name, term), ilike(units.callsign, term), ilike(units.location, term));
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(units.status, statuses));
    const department = single(params.filters.department);
    if (department) conditions.push(eq(units.departmentId, department));
    const where = combine(...conditions);

    const rows = await db
      .select({
        id: units.id,
        name: units.name,
        callsign: units.callsign,
        status: units.status,
        statusNote: units.statusNote,
        statusUpdatedAt: units.statusUpdatedAt,
        location: units.location,
        departmentId: units.departmentId,
        departmentName: departments.name,
        vehicleId: units.vehicleId,
        vehicleRegistration: vehicles.registration,
        active: units.active,
      })
      .from(units)
      .leftJoin(departments, eq(departments.id, units.departmentId))
      .leftJoin(vehicles, eq(vehicles.id, units.vehicleId))
      .where(where)
      .orderBy(units.callsign)
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(units).where(where);
    const ids = rows.map((row) => row.id);
    const members = ids.length
      ? await db
          .select({ unitId: unitMembers.unitId, id: users.id, name: users.name, role: unitMembers.role, jobTitle: users.jobTitle })
          .from(unitMembers)
          .innerJoin(users, eq(users.id, unitMembers.userId))
          .where(inArray(unitMembers.unitId, ids))
      : [];

    return {
      rows: rows.map((row) => ({
        ...row,
        personnel: members.filter((member) => member.unitId === row.id).map(({ unitId: _unitId, ...member }) => member),
      })),
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "units.view");
    const [unit] = await db
      .select({
        id: units.id,
        name: units.name,
        callsign: units.callsign,
        status: units.status,
        statusNote: units.statusNote,
        statusUpdatedAt: units.statusUpdatedAt,
        location: units.location,
        latitude: units.latitude,
        longitude: units.longitude,
        departmentId: units.departmentId,
        departmentName: departments.name,
        vehicleId: units.vehicleId,
        vehicleRegistration: vehicles.registration,
        notes: units.notes,
        active: units.active,
        createdAt: units.createdAt,
        updatedAt: units.updatedAt,
      })
      .from(units)
      .leftJoin(departments, eq(departments.id, units.departmentId))
      .leftJoin(vehicles, eq(vehicles.id, units.vehicleId))
      .where(and(eq(units.id, id), isNull(units.deletedAt)))
      .limit(1);

    if (!unit) throw AppError.notFound("This unit does not exist.");

    const [members, assignments, recentCalls] = await Promise.all([
      db
        .select({ id: unitMembers.id, userId: users.id, name: users.name, jobTitle: users.jobTitle, role: unitMembers.role, joinedAt: unitMembers.joinedAt })
        .from(unitMembers)
        .innerJoin(users, eq(users.id, unitMembers.userId))
        .where(eq(unitMembers.unitId, id)),
      db
        .select({ id: units.id, callsign: units.callsign })
        .from(units)
        .where(eq(units.id, id))
        .limit(1),
      db
        .select({ id: calls.id, reference: calls.reference, status: calls.status, priority: calls.priority, receivedAt: calls.receivedAt })
        .from(callUnits)
        .innerJoin(calls, eq(calls.id, callUnits.callId))
        .where(eq(callUnits.unitId, id))
        .orderBy(desc(calls.receivedAt))
        .limit(20),
    ]);

    return { ...unit, personnel: members, assignments, recentCalls };
  },

  async create(ctx: RequestContext, input: UnitUpsertInput) {
    assertCan(ctx, "admin.units.manage");
    const [created] = await db
      .insert(units)
      .values({
        name: input.name,
        callsign: input.callsign.toUpperCase(),
        departmentId: input.departmentId,
        status: input.status,
        location: input.location,
        vehicleId: input.vehicleId,
        notes: input.notes,
        statusUpdatedAt: new Date(),
      })
      .returning();

    if (input.memberIds.length) {
      await db.insert(unitMembers).values(input.memberIds.map((userId) => ({ unitId: created!.id, userId }))).onConflictDoNothing();
    }

    await recordAudit({ action: "unit.created", resourceType: "unit", resourceId: created!.id, summary: `Created unit ${created!.callsign}` });
    await recordTimeline({ recordType: "unit", recordId: created!.id, type: "CREATED", message: `Unit created by ${ctx.user.name}` });
    return created;
  },

  async update(ctx: RequestContext, id: string, input: UnitUpsertInput) {
    assertCan(ctx, "admin.units.manage");
    const [existing] = await db.select().from(units).where(and(eq(units.id, id), isNull(units.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This unit does not exist.");

    const [updated] = await db
      .update(units)
      .set({
        name: input.name,
        callsign: input.callsign.toUpperCase(),
        departmentId: input.departmentId,
        status: input.status,
        location: input.location,
        vehicleId: input.vehicleId,
        notes: input.notes,
        statusUpdatedAt: input.status === existing.status ? existing.statusUpdatedAt : new Date(),
      })
      .where(eq(units.id, id))
      .returning();

    await db.delete(unitMembers).where(eq(unitMembers.unitId, id));
    if (input.memberIds.length) {
      await db.insert(unitMembers).values(input.memberIds.map((userId) => ({ unitId: id, userId }))).onConflictDoNothing();
    }

    await recordAudit({
      action: "unit.updated",
      resourceType: "unit",
      resourceId: id,
      summary: `Updated unit ${existing.callsign}`,
      previousValue: { status: existing.status, callsign: existing.callsign },
      newValue: { status: input.status, callsign: input.callsign },
    });
    return updated;
  },

  async setStatus(ctx: RequestContext, id: string, status: string, note?: string | null, location?: string | null) {
    assertCan(ctx, "units.status");
    const [existing] = await db.select().from(units).where(eq(units.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This unit does not exist.");

    const [updated] = await db
      .update(units)
      .set({ status, statusNote: note ?? null, statusUpdatedAt: new Date(), location: location ?? existing.location })
      .where(eq(units.id, id))
      .returning();

    publish({ type: "unit.status.changed", payload: { unitId: id, status, callsign: existing.callsign } });
    await recordTimeline({
      recordType: "unit",
      recordId: id,
      type: "STATUS",
      message: note ? `Status changed to ${status} - ${note}` : `Status changed to ${status}`,
      metadata: { previous: existing.status, next: status },
    });
    await recordAudit({
      action: "unit.status.changed",
      resourceType: "unit",
      resourceId: id,
      summary: `Unit ${existing.callsign} status changed to ${status}`,
      previousValue: { status: existing.status },
      newValue: { status, note },
    });
    return updated;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.units.manage");
    const [existing] = await db.select().from(units).where(eq(units.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This unit does not exist.");
    await db.update(units).set({ deletedAt: new Date() }).where(eq(units.id, id));
    await recordAudit({ action: "unit.deleted", resourceType: "unit", resourceId: id, summary: `Deleted unit ${existing.callsign}` });
    return { id };
  },
};

