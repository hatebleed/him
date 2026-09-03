import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  callUnits,
  calls,
  caseIncidents,
  cases,
  departments,
  evidence,
  incidentAssignments,
  incidentParticipants,
  incidentVehicles,
  incidents,
  persons,
  reports,
  tasks,
  units,
  users,
  vehicles,
} from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { IncidentUpsertInput } from "@/lib/validation/operations";

import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { getClosedStatuses } from "../configuration/service";
import { notificationService } from "../notifications/service";
import { readCustomValues, readCustomValuesForRecord, writeCustomValues } from "./custom-fields";
import { combine, multi, orderByDirection, single, type ListParams } from "./pagination";
import { nextReference, REFERENCE_PREFIXES } from "./reference";
import { runWorkflows } from "../workflows/engine";

const sortColumns = {
  reference: incidents.reference,
  title: incidents.title,
  status: incidents.status,
  priority: incidents.priority,
  reportedAt: incidents.reportedAt,
  createdAt: incidents.createdAt,
} as const;

export const incidentService = {
  async list(ctx: RequestContext, params: ListParams) {
    assertCan(ctx, "incidents.view");
    const conditions: SQL[] = [isNull(incidents.deletedAt)];

    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(
        ilike(incidents.reference, term),
        ilike(incidents.title, term),
        ilike(incidents.description, term),
        ilike(incidents.location, term),
      );
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(incidents.status, statuses));
    const priorities = multi(params.filters.priority);
    if (priorities.length) conditions.push(inArray(incidents.priority, priorities));
    const department = single(params.filters.department);
    if (department) conditions.push(eq(incidents.departmentId, department));
    const category = single(params.filters.category);
    if (category) conditions.push(eq(incidents.categoryId, category));
    const assignedUserId = single(params.filters.assignedTo);
    if (assignedUserId) {
      conditions.push(
        inArray(
          incidents.id,
          db.select({ id: incidentAssignments.incidentId }).from(incidentAssignments).where(eq(incidentAssignments.userId, assignedUserId)),
        ),
      );
    }

    const where = combine(...conditions);
    const sortColumn = sortColumns[(params.sort ?? "reportedAt") as keyof typeof sortColumns] ?? incidents.reportedAt;

    const rows = await db
      .select({
        id: incidents.id,
        reference: incidents.reference,
        title: incidents.title,
        status: incidents.status,
        priority: incidents.priority,
        location: incidents.location,
        reportedAt: incidents.reportedAt,
        occurredAt: incidents.occurredAt,
        closedAt: incidents.closedAt,
        departmentId: incidents.departmentId,
        departmentName: departments.name,
        createdAt: incidents.createdAt,
      })
      .from(incidents)
      .leftJoin(departments, eq(departments.id, incidents.departmentId))
      .where(where)
      .orderBy(orderByDirection(sortColumn, params.dir))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(incidents).where(where);
    const ids = rows.map((row) => row.id);
    const customValues = await readCustomValues("incident", ids);

    const assignmentRows = ids.length
      ? await db
          .select({ incidentId: incidentAssignments.incidentId, unitCallsign: units.callsign, userName: users.name })
          .from(incidentAssignments)
          .leftJoin(units, eq(units.id, incidentAssignments.unitId))
          .leftJoin(users, eq(users.id, incidentAssignments.userId))
          .where(inArray(incidentAssignments.incidentId, ids))
      : [];

    const assignments = new Map<string, string[]>();
    for (const row of assignmentRows) {
      const list = assignments.get(row.incidentId) ?? [];
      const label = row.unitCallsign ?? row.userName;
      if (label) list.push(label);
      assignments.set(row.incidentId, list);
    }

    return {
      rows: rows.map((row) => ({
        ...row,
        assigned: assignments.get(row.id) ?? [],
        customFields: customValues.get(row.id) ?? {},
      })),
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "incidents.view");
    const [incident] = await db
      .select({
        id: incidents.id,
        reference: incidents.reference,
        title: incidents.title,
        description: incidents.description,
        status: incidents.status,
        priority: incidents.priority,
        categoryId: incidents.categoryId,
        departmentId: incidents.departmentId,
        departmentName: departments.name,
        location: incidents.location,
        latitude: incidents.latitude,
        longitude: incidents.longitude,
        reportedAt: incidents.reportedAt,
        occurredAt: incidents.occurredAt,
        closedAt: incidents.closedAt,
        supervisorId: incidents.supervisorId,
        supervisorName: users.name,
        createdAt: incidents.createdAt,
        updatedAt: incidents.updatedAt,
      })
      .from(incidents)
      .leftJoin(departments, eq(departments.id, incidents.departmentId))
      .leftJoin(users, eq(users.id, incidents.supervisorId))
      .where(and(eq(incidents.id, id), isNull(incidents.deletedAt)))
      .limit(1);

    if (!incident) throw AppError.notFound("This incident does not exist or has been deleted.");

    const [participants, vehicleLinks, assignmentRows, reportRows, evidenceRows, taskRows, callRows, caseRows, customFields] =
      await Promise.all([
        db
          .select({
            id: incidentParticipants.id,
            role: incidentParticipants.role,
            notes: incidentParticipants.notes,
            personId: persons.id,
            reference: persons.reference,
            firstName: persons.firstName,
            lastName: persons.lastName,
            status: persons.status,
          })
          .from(incidentParticipants)
          .innerJoin(persons, eq(persons.id, incidentParticipants.personId))
          .where(eq(incidentParticipants.incidentId, id)),
        db
          .select({
            id: incidentVehicles.id,
            role: incidentVehicles.role,
            vehicleId: vehicles.id,
            reference: vehicles.reference,
            registration: vehicles.registration,
            make: vehicles.make,
            model: vehicles.model,
            colour: vehicles.colour,
          })
          .from(incidentVehicles)
          .innerJoin(vehicles, eq(vehicles.id, incidentVehicles.vehicleId))
          .where(eq(incidentVehicles.incidentId, id)),
        db
          .select({
            id: incidentAssignments.id,
            role: incidentAssignments.role,
            assignedAt: incidentAssignments.assignedAt,
            clearedAt: incidentAssignments.clearedAt,
            unitId: units.id,
            unitName: units.name,
            callsign: units.callsign,
            unitStatus: units.status,
            userId: users.id,
            userName: users.name,
          })
          .from(incidentAssignments)
          .leftJoin(units, eq(units.id, incidentAssignments.unitId))
          .leftJoin(users, eq(users.id, incidentAssignments.userId))
          .where(eq(incidentAssignments.incidentId, id))
          .orderBy(desc(incidentAssignments.assignedAt)),
        db
          .select({ id: reports.id, reference: reports.reference, title: reports.title, status: reports.status, createdAt: reports.createdAt })
          .from(reports)
          .where(eq(reports.incidentId, id))
          .orderBy(desc(reports.createdAt))
          .limit(50),
        db.select().from(evidence).where(eq(evidence.incidentId, id)).orderBy(desc(evidence.createdAt)).limit(50),
        db
          .select({ id: tasks.id, reference: tasks.reference, title: tasks.title, status: tasks.status, priority: tasks.priority, dueAt: tasks.dueAt })
          .from(tasks)
          .where(and(eq(tasks.recordType, "incident"), eq(tasks.recordId, id), isNull(tasks.deletedAt)))
          .orderBy(desc(tasks.createdAt))
          .limit(50),
        db
          .select({ id: calls.id, reference: calls.reference, status: calls.status, priority: calls.priority, receivedAt: calls.receivedAt })
          .from(calls)
          .where(eq(calls.incidentId, id))
          .orderBy(desc(calls.receivedAt))
          .limit(20),
        db
          .select({ id: cases.id, reference: cases.reference, title: cases.title, status: cases.status })
          .from(caseIncidents)
          .innerJoin(cases, eq(cases.id, caseIncidents.caseId))
          .where(eq(caseIncidents.incidentId, id)),
        readCustomValuesForRecord("incident", id),
      ]);

    const unitIds = assignmentRows.map((row) => row.unitId).filter((value): value is string => Boolean(value));
    const callUnitRows = callRows.length
      ? await db
          .select({ callId: callUnits.callId, callsign: units.callsign })
          .from(callUnits)
          .innerJoin(units, eq(units.id, callUnits.unitId))
          .where(inArray(callUnits.callId, callRows.map((row) => row.id)))
      : [];

    const callsWithUnits = callRows.map((call) => ({
      ...call,
      units: callUnitRows.filter((row) => row.callId === call.id).map((row) => row.callsign),
    }));

    return {
      ...incident,
      participants,
      vehicles: vehicleLinks,
      assignments: assignmentRows,
      reports: reportRows,
      evidence: evidenceRows,
      tasks: taskRows,
      calls: callsWithUnits,
      cases: caseRows,
      customFields,
      unitIds,
    };
  },

  async create(ctx: RequestContext, input: IncidentUpsertInput) {
    assertCan(ctx, "incidents.create");
    const reference = await nextReference(incidents, REFERENCE_PREFIXES.incident);
    const [created] = await db
      .insert(incidents)
      .values({
        reference,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        occurredAt: input.occurredAt,
        reportedAt: input.reportedAt ?? new Date(),
        supervisorId: input.supervisorId,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning();

    if (!created) throw AppError.badRequest("The incident could not be created.");
    if (input.customFields) await writeCustomValues("incident", created.id, input.customFields);

    await recordAudit({
      action: "incident.created",
      resourceType: "incident",
      resourceId: created.id,
      summary: `Created incident ${created.reference}`,
      newValue: { reference: created.reference, title: created.title, priority: created.priority },
    });
    await recordTimeline({ recordType: "incident", recordId: created.id, type: "CREATED", message: `Incident created by ${ctx.user.name}` });

    await runWorkflows({ trigger: "RECORD_CREATED", resourceType: "incident", recordId: created.id, context: { priority: created.priority, status: created.status } });

    return created;
  },

  async update(ctx: RequestContext, id: string, input: IncidentUpsertInput) {
    assertCan(ctx, "incidents.edit");
    const [existing] = await db.select().from(incidents).where(and(eq(incidents.id, id), isNull(incidents.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This incident does not exist.");

    const [updated] = await db
      .update(incidents)
      .set({
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        occurredAt: input.occurredAt,
        reportedAt: input.reportedAt ?? existing.reportedAt,
        supervisorId: input.supervisorId,
        updatedById: ctx.user.id,
      })
      .where(eq(incidents.id, id))
      .returning();

    if (input.customFields) await writeCustomValues("incident", id, input.customFields);
    await recordAudit({
      action: "incident.updated",
      resourceType: "incident",
      resourceId: id,
      summary: `Updated incident ${existing.reference}`,
      previousValue: { title: existing.title, status: existing.status, priority: existing.priority },
      newValue: { title: input.title, status: input.status, priority: input.priority },
    });
    return updated;
  },

  async changeStatus(ctx: RequestContext, id: string, status: string, note?: string | null) {
    assertCan(ctx, "incidents.edit");
    const [existing] = await db.select().from(incidents).where(and(eq(incidents.id, id), isNull(incidents.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This incident does not exist.");

    const closedStatuses = await getClosedStatuses("incident");
    const isClosing = closedStatuses.includes(status) && !closedStatuses.includes(existing.status);

    const [updated] = await db
      .update(incidents)
      .set({
        status,
        closedAt: isClosing ? new Date() : closedStatuses.includes(status) ? existing.closedAt : null,
        updatedById: ctx.user.id,
      })
      .where(eq(incidents.id, id))
      .returning();

    await recordTimeline({
      recordType: "incident",
      recordId: id,
      type: "STATUS",
      message: note ? `Status changed from ${existing.status} to ${status} - ${note}` : `Status changed from ${existing.status} to ${status}`,
      metadata: { previous: existing.status, next: status },
    });
    await recordAudit({
      action: "incident.status.changed",
      resourceType: "incident",
      resourceId: id,
      summary: `Incident ${existing.reference} status changed to ${status}`,
      previousValue: { status: existing.status },
      newValue: { status },
    });

    await runWorkflows({
      trigger: "STATUS_CHANGED",
      resourceType: "incident",
      recordId: id,
      context: { status, previousStatus: existing.status, priority: existing.priority },
    });

    return updated;
  },

  async linkPerson(ctx: RequestContext, incidentId: string, input: { personId: string; role: string; notes?: string | null }) {
    assertCan(ctx, "incidents.edit");
    const [incident] = await db.select({ id: incidents.id, reference: incidents.reference }).from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    if (!incident) throw AppError.notFound("This incident does not exist.");
    const [person] = await db.select({ id: persons.id, reference: persons.reference, firstName: persons.firstName, lastName: persons.lastName }).from(persons).where(eq(persons.id, input.personId)).limit(1);
    if (!person) throw AppError.notFound("This person does not exist.");

    await db.insert(incidentParticipants).values({ incidentId, personId: input.personId, role: input.role, notes: input.notes ?? null }).onConflictDoNothing();

    await recordTimeline({
      recordType: "incident",
      recordId: incidentId,
      type: "RELATIONSHIP",
      message: `Linked person ${person.firstName} ${person.lastName} (${input.role.toLowerCase()})`,
    });
    await recordTimeline({
      recordType: "person",
      recordId: input.personId,
      type: "RELATIONSHIP",
      message: `Linked to incident ${incident.reference}`,
    });
    await recordAudit({
      action: "incident.person.linked",
      resourceType: "incident",
      resourceId: incidentId,
      summary: `Linked person ${person.reference}`,
      newValue: { personId: input.personId, role: input.role },
    });
    return { ok: true };
  },

  async unlinkPerson(ctx: RequestContext, incidentId: string, personId: string) {
    assertCan(ctx, "incidents.edit");
    await db.delete(incidentParticipants).where(and(eq(incidentParticipants.incidentId, incidentId), eq(incidentParticipants.personId, personId)));
    await recordAudit({ action: "incident.person.unlinked", resourceType: "incident", resourceId: incidentId, summary: "Removed person link", newValue: { personId } });
    await recordTimeline({ recordType: "incident", recordId: incidentId, type: "RELATIONSHIP", message: "Removed person link" });
    return { ok: true };
  },

  async linkVehicle(ctx: RequestContext, incidentId: string, input: { vehicleId: string; role: string; notes?: string | null }) {
    assertCan(ctx, "incidents.edit");
    const [incident] = await db.select({ id: incidents.id, reference: incidents.reference }).from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    if (!incident) throw AppError.notFound("This incident does not exist.");
    const [vehicle] = await db.select({ id: vehicles.id, registration: vehicles.registration }).from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1);
    if (!vehicle) throw AppError.notFound("This vehicle does not exist.");

    await db.insert(incidentVehicles).values({ incidentId, vehicleId: input.vehicleId, role: input.role, notes: input.notes ?? null }).onConflictDoNothing();

    await recordTimeline({ recordType: "incident", recordId: incidentId, type: "RELATIONSHIP", message: `Linked vehicle ${vehicle.registration}` });
    await recordTimeline({ recordType: "vehicle", recordId: input.vehicleId, type: "RELATIONSHIP", message: `Linked to incident ${incident.reference}` });
    await recordAudit({
      action: "incident.vehicle.linked",
      resourceType: "incident",
      resourceId: incidentId,
      summary: `Linked vehicle ${vehicle.registration}`,
      newValue: { vehicleId: input.vehicleId, role: input.role },
    });
    return { ok: true };
  },

  async unlinkVehicle(ctx: RequestContext, incidentId: string, vehicleId: string) {
    assertCan(ctx, "incidents.edit");
    await db.delete(incidentVehicles).where(and(eq(incidentVehicles.incidentId, incidentId), eq(incidentVehicles.vehicleId, vehicleId)));
    await recordAudit({ action: "incident.vehicle.unlinked", resourceType: "incident", resourceId: incidentId, summary: "Removed vehicle link", newValue: { vehicleId } });
    await recordTimeline({ recordType: "incident", recordId: incidentId, type: "RELATIONSHIP", message: "Removed vehicle link" });
    return { ok: true };
  },

  async assign(ctx: RequestContext, incidentId: string, input: { unitId?: string | null; userId?: string | null; role: string; notes?: string | null }) {
    assertCan(ctx, "incidents.assign");
    const [incident] = await db.select({ id: incidents.id, reference: incidents.reference }).from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    if (!incident) throw AppError.notFound("This incident does not exist.");
    if (!input.unitId && !input.userId) throw AppError.badRequest("Assign either a unit or a person.");

    const [assignment] = await db
      .insert(incidentAssignments)
      .values({ incidentId, unitId: input.unitId ?? null, userId: input.userId ?? null, role: input.role, notes: input.notes ?? null })
      .returning();

    let label = "resource";
    if (input.unitId) {
      const [unit] = await db.select({ callsign: units.callsign, name: units.name }).from(units).where(eq(units.id, input.unitId)).limit(1);
      label = unit ? `${unit.callsign}` : "unit";
    } else if (input.userId) {
      const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1);
      label = user?.name ?? "user";
    }

    await recordTimeline({ recordType: "incident", recordId: incidentId, type: "ASSIGNMENT", message: `Assigned ${label}` });
    await recordAudit({
      action: "incident.assigned",
      resourceType: "incident",
      resourceId: incidentId,
      summary: `Assigned ${label} to ${incident.reference}`,
      newValue: { unitId: input.unitId, userId: input.userId, role: input.role },
    });

    if (input.userId && input.userId !== ctx.user.id) {
      await notificationService.send({
        userId: input.userId,
        type: "ASSIGNMENT",
        category: "ASSIGNMENTS",
        title: "You were assigned to an incident",
        message: `${incident.reference}: ${ctx.user.name} assigned you.`,
        resourceType: "incident",
        resourceId: incidentId,
      });
    }

    await runWorkflows({ trigger: "USER_ASSIGNED", resourceType: "incident", recordId: incidentId, context: { assigneeId: input.userId ?? null, unitId: input.unitId ?? null, status: incident.reference } });

    return assignment;
  },

  async unassign(ctx: RequestContext, incidentId: string, assignmentId: string) {
    assertCan(ctx, "incidents.assign");
    await db.delete(incidentAssignments).where(and(eq(incidentAssignments.id, assignmentId), eq(incidentAssignments.incidentId, incidentId)));
    await recordAudit({ action: "incident.unassigned", resourceType: "incident", resourceId: incidentId, summary: "Removed assignment", newValue: { assignmentId } });
    return { ok: true };
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "incidents.delete");
    const [existing] = await db.select().from(incidents).where(and(eq(incidents.id, id), isNull(incidents.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This incident does not exist.");
    await db.update(incidents).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(incidents.id, id));
    await recordAudit({ action: "incident.deleted", resourceType: "incident", resourceId: id, summary: `Deleted incident ${existing.reference}` });
    return { id };
  },

  async search(ctx: RequestContext, term: string, limit = 10) {
    assertCan(ctx, "incidents.view");
    const query = `%${term}%`;
    return db
      .select({ id: incidents.id, reference: incidents.reference, title: incidents.title, status: incidents.status })
      .from(incidents)
      .where(and(isNull(incidents.deletedAt), or(ilike(incidents.reference, query), ilike(incidents.title, query))))
      .limit(limit);
  },
};
