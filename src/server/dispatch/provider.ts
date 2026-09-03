import "server-only";

import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { callUnits, calls, departments, incidentAssignments, units, unitMembers, users, vehicles } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";

/**
 * Dispatch abstraction.
 *
 * The platform never talks to a CAD system directly: it talks to this
 * interface. `MockDispatchProvider` is a fully working implementation backed
 * by the platform's own tables (used for development and demo). A real
 * provider can be added later by implementing the same interface and
 * selecting it with `DISPATCH_PROVIDER`.
 */
export type DispatchUnit = {
  id: string;
  name: string;
  callsign: string;
  status: string;
  statusNote: string | null;
  statusUpdatedAt: Date | null;
  location: string | null;
  departmentId: string | null;
  departmentName: string | null;
  vehicle: { id: string; registration: string } | null;
  personnel: Array<{ id: string; name: string; role: string }>;
  activeCallId: string | null;
};

export type DispatchCall = {
  id: string;
  reference: string;
  type: string;
  priority: string;
  status: string;
  description: string | null;
  location: string | null;
  callerName: string | null;
  callerPhone: string | null;
  receivedAt: Date;
  dispatchedAt: Date | null;
  closedAt: Date | null;
  incidentId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  units: Array<{ id: string; callsign: string; name: string; status: string; assignedAt: Date; arrivedAt: Date | null; clearedAt: Date | null }>;
};

export interface DispatchProvider {
  readonly name: string;
  getActiveCalls(): Promise<DispatchCall[]>;
  getCalls(limit?: number): Promise<DispatchCall[]>;
  getCall(id: string): Promise<DispatchCall | null>;
  getUnits(): Promise<DispatchUnit[]>;
  getUnit(id: string): Promise<DispatchUnit | null>;
  getUnitStatus(unitId: string): Promise<string | null>;
  updateUnitStatus(unitId: string, status: string, note?: string | null, location?: string | null): Promise<DispatchUnit>;
  assignUnit(callId: string, unitId: string, status?: string): Promise<DispatchCall>;
  unassignUnit(callId: string, unitId: string): Promise<DispatchCall>;
  updateCallUnitStatus(callId: string, unitId: string, status: string): Promise<DispatchCall>;
  sendMessage(unitId: string, message: string): Promise<{ delivered: number }>;
}

export class MockDispatchProvider implements DispatchProvider {
  readonly name = "mock";

  async getUnits(): Promise<DispatchUnit[]> {
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
      })
      .from(units)
      .leftJoin(departments, eq(departments.id, units.departmentId))
      .where(and(isNull(units.deletedAt), eq(units.active, true)))
      .orderBy(asc(units.callsign));

    const unitIds = rows.map((row) => row.id);
    const members = unitIds.length
      ? await db
          .select({ unitId: unitMembers.unitId, id: users.id, name: users.name, role: unitMembers.role })
          .from(unitMembers)
          .innerJoin(users, eq(users.id, unitMembers.userId))
          .where(eq(users.status, "ACTIVE"))
      : [];
    const vehicleIds = rows.map((row) => row.vehicleId).filter((value): value is string => Boolean(value));
    const vehicleRows = vehicleIds.length
      ? await db
          .select({ id: vehicles.id, registration: vehicles.registration })
          .from(vehicles)
          .where(inArray(vehicles.id, vehicleIds))
      : [];
    const vehicleById = new Map(vehicleRows.map((row) => [row.id, row] as const));

    const activeAssignments = unitIds.length
      ? await db
          .select({ unitId: callUnits.unitId, callId: callUnits.callId })
          .from(callUnits)
          .innerJoin(calls, eq(calls.id, callUnits.callId))
          .where(and(isNull(callUnits.clearedAt), inArray(callUnits.unitId, unitIds)))
      : [];
    const activeCallByUnit = new Map(activeAssignments.map((row) => [row.unitId, row.callId] as const));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      callsign: row.callsign,
      status: row.status,
      statusNote: row.statusNote,
      statusUpdatedAt: row.statusUpdatedAt,
      location: row.location,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      vehicle: row.vehicleId ? (vehicleById.get(row.vehicleId) ?? null) : null,
      personnel: members
        .filter((member) => member.unitId === row.id)
        .map((member) => ({ id: member.id, name: member.name, role: member.role })),
      activeCallId: activeCallByUnit.get(row.id) ?? null,
    }));
  }

  async getUnit(id: string): Promise<DispatchUnit | null> {
    const all = await this.getUnits();
    return all.find((unit) => unit.id === id) ?? null;
  }

  async getUnitStatus(unitId: string): Promise<string | null> {
    const [row] = await db.select({ status: units.status }).from(units).where(eq(units.id, unitId)).limit(1);
    return row?.status ?? null;
  }

  async updateUnitStatus(unitId: string, status: string, note?: string | null, location?: string | null): Promise<DispatchUnit> {
    await db
      .update(units)
      .set({
        status,
        statusNote: note ?? null,
        statusUpdatedAt: new Date(),
        location: location ?? undefined,
      })
      .where(eq(units.id, unitId));
    const unit = await this.getUnit(unitId);
    if (!unit) throw AppError.notFound("This unit does not exist.");
    return unit;
  }

  private async loadCalls(conditions: ReturnType<typeof and> | undefined, limit: number): Promise<DispatchCall[]> {
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
        callerPhone: calls.callerPhone,
        receivedAt: calls.receivedAt,
        dispatchedAt: calls.dispatchedAt,
        closedAt: calls.closedAt,
        incidentId: calls.incidentId,
        departmentId: calls.departmentId,
        departmentName: departments.name,
      })
      .from(calls)
      .leftJoin(departments, eq(departments.id, calls.departmentId))
      .where(conditions)
      .orderBy(desc(calls.receivedAt))
      .limit(limit);

    if (rows.length === 0) return [];
    const assignments = await db
      .select({
        callId: callUnits.callId,
        unitId: units.id,
        callsign: units.callsign,
        name: units.name,
        status: callUnits.status,
        assignedAt: callUnits.assignedAt,
        arrivedAt: callUnits.arrivedAt,
        clearedAt: callUnits.clearedAt,
      })
      .from(callUnits)
      .innerJoin(units, eq(units.id, callUnits.unitId))
      .where(
        or(...rows.map((row) => eq(callUnits.callId, row.id))) ?? undefined,
      );

    return rows.map((row) => ({
      ...row,
      units: assignments
        .filter((assignment) => assignment.callId === row.id)
        .map(({ callId: _callId, unitId, ...assignment }) => ({ ...assignment, id: unitId })),
    }));
  }

  async getActiveCalls(): Promise<DispatchCall[]> {
    // "Active" = not closed and not cancelled.
    return this.loadCalls(
      and(
        or(eq(calls.status, "PENDING"), eq(calls.status, "DISPATCHED"), eq(calls.status, "ON_SCENE")) ?? undefined,
      ),
      200,
    );
  }

  async getCalls(limit = 100): Promise<DispatchCall[]> {
    return this.loadCalls(undefined, limit);
  }

  async getCall(id: string): Promise<DispatchCall | null> {
    const [row] = await this.loadCalls(eq(calls.id, id), 1);
    return row ?? null;
  }

  async assignUnit(callId: string, unitId: string, status = "ASSIGNED"): Promise<DispatchCall> {
    const [call] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
    if (!call) throw AppError.notFound("This call does not exist.");
    const [unit] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
    if (!unit) throw AppError.notFound("This unit does not exist.");

    await db.insert(callUnits).values({ callId, unitId, status }).onConflictDoNothing();
    await db
      .update(calls)
      .set({ status: call.status === "PENDING" ? "DISPATCHED" : call.status, dispatchedAt: call.dispatchedAt ?? new Date() })
      .where(eq(calls.id, callId));
    if (call.incidentId) {
      await db.insert(incidentAssignments).values({ incidentId: call.incidentId, unitId, role: "ASSIGNED" }).onConflictDoNothing();
    }
    const updated = await this.getCall(callId);
    if (!updated) throw AppError.notFound("This call does not exist.");
    return updated;
  }

  async unassignUnit(callId: string, unitId: string): Promise<DispatchCall> {
    await db.delete(callUnits).where(and(eq(callUnits.callId, callId), eq(callUnits.unitId, unitId)));
    const updated = await this.getCall(callId);
    if (!updated) throw AppError.notFound("This call does not exist.");
    return updated;
  }

  async updateCallUnitStatus(callId: string, unitId: string, status: string): Promise<DispatchCall> {
    await db
      .update(callUnits)
      .set({
        status,
        arrivedAt: status === "ON_SCENE" ? new Date() : undefined,
        clearedAt: status === "CLEARED" ? new Date() : undefined,
      })
      .where(and(eq(callUnits.callId, callId), eq(callUnits.unitId, unitId)));
    if (status === "ON_SCENE") {
      await db.update(calls).set({ status: "ON_SCENE" }).where(eq(calls.id, callId));
    }
    const updated = await this.getCall(callId);
    if (!updated) throw AppError.notFound("This call does not exist.");
    return updated;
  }

  async sendMessage(unitId: string, message: string): Promise<{ delivered: number }> {
    const rows = await db
      .select({ userId: unitMembers.userId })
      .from(unitMembers)
      .where(eq(unitMembers.unitId, unitId));
    const { notificationService } = await import("@/server/notifications/service");
    const delivered = await notificationService.sendToMany(rows.map((row) => row.userId), {
      type: "DISPATCH",
      category: "DISPATCH",
      title: "Dispatch message",
      message,
      resourceType: "unit",
      resourceId: unitId,
      priority: "HIGH",
    });
    return { delivered };
  }
}

export function getDispatchProvider(): DispatchProvider {
  return new MockDispatchProvider();
}

export const dispatchProvider = getDispatchProvider();
