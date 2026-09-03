import "server-only";

import { and, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { auditLogs, callUnits, calls, incidents, units } from "@/lib/db/schema";
import { SECTOR_DISTRICTS } from "@/config/defaults";
import { assertCan, type RequestContext } from "@/server/context";
import { getClosedStatuses } from "@/server/configuration/service";

/**
 * Operations wall.
 *
 * One payload for the live console: unit positions, open incidents, active
 * calls, the numbers that matter and a running feed of what just happened.
 * Everything is read through the normal permission gates - the wall never shows
 * a record the operator could not open.
 */

export type OpsWallPayload = Awaited<ReturnType<typeof opsWallService.snapshot>>;

export const opsWallService = {
  async snapshot(ctx: RequestContext) {
    assertCan(ctx, "dispatch.view");

    const [closedIncidents, closedCalls] = await Promise.all([getClosedStatuses("incident"), getClosedStatuses("call")]);

    const [unitRows, incidentRows, callRows, eventRows] = await Promise.all([
      db
        .select({
          id: units.id,
          callsign: units.callsign,
          name: units.name,
          status: units.status,
          statusNote: units.statusNote,
          statusUpdatedAt: units.statusUpdatedAt,
          location: units.location,
          latitude: units.latitude,
          longitude: units.longitude,
        })
        .from(units)
        .where(and(isNull(units.deletedAt), eq(units.active, true)))
        .orderBy(units.callsign)
        .limit(120),

      db
        .select({
          id: incidents.id,
          reference: incidents.reference,
          title: incidents.title,
          status: incidents.status,
          priority: incidents.priority,
          location: incidents.location,
          latitude: incidents.latitude,
          longitude: incidents.longitude,
          occurredAt: incidents.occurredAt,
          reportedAt: incidents.reportedAt,
        })
        .from(incidents)
        .where(and(isNull(incidents.deletedAt), closedIncidents.length ? notInArray(incidents.status, closedIncidents) : undefined))
        .orderBy(desc(incidents.reportedAt))
        .limit(200),

      db
        .select({
          id: calls.id,
          reference: calls.reference,
          type: calls.type,
          priority: calls.priority,
          status: calls.status,
          location: calls.location,
          description: calls.description,
          receivedAt: calls.receivedAt,
          dispatchedAt: calls.dispatchedAt,
        })
        .from(calls)
        .where(and(closedCalls.length ? notInArray(calls.status, closedCalls) : undefined))
        .orderBy(desc(calls.receivedAt))
        .limit(60),

      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          summary: auditLogs.summary,
          resourceType: auditLogs.resourceType,
          resourceId: auditLogs.resourceId,
          actorName: auditLogs.actorName,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(24),
    ]);

    // Units assigned to each active call.
    const assignments = callRows.length
      ? await db
          .select({ callId: callUnits.callId, callsign: units.callsign, status: callUnits.status })
          .from(callUnits)
          .innerJoin(units, eq(units.id, callUnits.unitId))
          .where(inArray(callUnits.callId, callRows.map((call) => call.id)))
      : [];

    const callsWithUnits = callRows.map((call) => ({
      ...call,
      assigned: assignments
        .filter((assignment) => assignment.callId === call.id)
        .map((assignment) => ({ callsign: assignment.callsign, status: assignment.status })),
    }));

    const available = unitRows.filter((unit) => unit.status === "AVAILABLE").length;
    const committed = unitRows.filter((unit) => ["EN_ROUTE", "ON_SCENE", "BUSY"].includes(unit.status)).length;
    const offAir = unitRows.filter((unit) => ["OUT_OF_SERVICE", "OFF_DUTY"].includes(unit.status)).length;

    // Mean time from a call being received to a unit being dispatched.
    const dispatched = callsWithUnits.filter((call) => call.dispatchedAt && call.receivedAt);
    const responseMinutes = dispatched.length
      ? dispatched.reduce((total, call) => total + (new Date(call.dispatchedAt!).getTime() - new Date(call.receivedAt).getTime()) / 60000, 0) /
        dispatched.length
      : null;

    return {
      generatedAt: new Date().toISOString(),
      districts: SECTOR_DISTRICTS,
      units: unitRows,
      incidents: incidentRows,
      calls: callsWithUnits,
      events: eventRows.map((event) => ({
        id: event.id,
        at: event.createdAt.toISOString(),
        label: event.summary ?? event.action.replace(/\./g, " · "),
        detail: [event.actorName, event.resourceType].filter(Boolean).join(" · "),
      })),
      metrics: {
        unitTotal: unitRows.length,
        unitAvailable: available,
        unitCommitted: committed,
        unitOffAir: offAir,
        readiness: unitRows.length ? Math.round((available / unitRows.length) * 100) : 0,
        openIncidents: incidentRows.length,
        criticalIncidents: incidentRows.filter((incident) => incident.priority === "CRITICAL").length,
        highIncidents: incidentRows.filter((incident) => incident.priority === "HIGH").length,
        activeCalls: callsWithUnits.length,
        pendingCalls: callsWithUnits.filter((call) => call.status === "PENDING").length,
        avgDispatchMinutes: responseMinutes === null ? null : Math.round(responseMinutes * 10) / 10,
      },
    };
  },
};
