import "server-only";

import { and, desc, eq, gte, isNull, notInArray, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { alerts, bolos, calls, incidentParticipants, incidents, persons, reports, units, warrants } from "@/lib/db/schema";
import { assertCan, type RequestContext } from "@/server/context";
import { getClosedStatuses } from "@/server/configuration/service";

/**
 * Shift briefing.
 *
 * Assembles the handover a supervisor reads out at roll call: what happened in
 * the period, what is still open, who and what to look for, and what resources
 * are available. Everything is drawn from live records - nothing is typed in.
 */

export type BriefingPayload = Awaited<ReturnType<typeof briefingService.generate>>;

export const briefingService = {
  async generate(ctx: RequestContext, params: { hours?: number } = {}) {
    assertCan(ctx, "dispatch.view");

    const hours = Math.max(1, Math.min(72, params.hours ?? 12));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [closedIncidents, closedCalls] = await Promise.all([getClosedStatuses("incident"), getClosedStatuses("call")]);

    const [opened, closed, openNow, callRows, notices, repeat, unitRows, reportRows] = await Promise.all([
      db
        .select({ id: incidents.id, reference: incidents.reference, title: incidents.title, priority: incidents.priority, status: incidents.status, location: incidents.location, reportedAt: incidents.reportedAt })
        .from(incidents)
        .where(and(isNull(incidents.deletedAt), gte(incidents.reportedAt, since)))
        .orderBy(desc(incidents.reportedAt))
        .limit(200),

      db
        .select({ id: incidents.id, reference: incidents.reference, title: incidents.title, closedAt: incidents.closedAt })
        .from(incidents)
        .where(and(isNull(incidents.deletedAt), gte(incidents.closedAt, since)))
        .orderBy(desc(incidents.closedAt!))
        .limit(200),

      db
        .select({ id: incidents.id, reference: incidents.reference, title: incidents.title, priority: incidents.priority, status: incidents.status, location: incidents.location, reportedAt: incidents.reportedAt })
        .from(incidents)
        .where(and(isNull(incidents.deletedAt), closedIncidents.length ? notInArray(incidents.status, closedIncidents) : undefined))
        .orderBy(desc(incidents.reportedAt))
        .limit(200),

      db
        .select({ id: calls.id, reference: calls.reference, type: calls.type, priority: calls.priority, status: calls.status, receivedAt: calls.receivedAt })
        .from(calls)
        .where(gte(calls.receivedAt, since))
        .orderBy(desc(calls.receivedAt))
        .limit(200),

      Promise.all([
        db
          .select({ id: bolos.id, reference: bolos.reference, subject: bolos.subject, priority: bolos.priority, description: bolos.description, expiresAt: bolos.expiresAt })
          .from(bolos)
          .where(and(isNull(bolos.deletedAt), eq(bolos.status, "ACTIVE")))
          .orderBy(desc(bolos.priority))
          .limit(10),
        db
          .select({ id: warrants.id, reference: warrants.reference, type: warrants.type, description: warrants.description, personId: warrants.personId })
          .from(warrants)
          .where(and(isNull(warrants.deletedAt), eq(warrants.status, "ACTIVE")))
          .orderBy(desc(warrants.issuedAt))
          .limit(10),
        db
          .select({ id: alerts.id, reference: alerts.reference, subject: alerts.subject, priority: alerts.priority, description: alerts.description })
          .from(alerts)
          .where(and(isNull(alerts.deletedAt), eq(alerts.status, "ACTIVE")))
          .orderBy(desc(alerts.createdAt))
          .limit(10),
      ]),

      // People involved in more than one incident during the period.
      db
        .select({
          id: persons.id,
          name: sql<string>`concat_ws(' ', ${persons.firstName}, ${persons.lastName})`,
          reference: persons.reference,
          riskLevel: persons.riskLevel,
          incidents: sql<number>`count(distinct ${incidentParticipants.incidentId})::int`,
        })
        .from(incidentParticipants)
        .innerJoin(persons, eq(persons.id, incidentParticipants.personId))
        .innerJoin(incidents, eq(incidents.id, incidentParticipants.incidentId))
        .where(and(isNull(persons.deletedAt), isNull(incidents.deletedAt), gte(incidents.reportedAt, since)))
        .groupBy(persons.id, persons.firstName, persons.lastName, persons.reference, persons.riskLevel)
        .having(sql`count(distinct ${incidentParticipants.incidentId}) > 1`)
        .orderBy(desc(sql`count(distinct ${incidentParticipants.incidentId})`))
        .limit(8),

      db
        .select({ id: units.id, callsign: units.callsign, name: units.name, status: units.status, location: units.location })
        .from(units)
        .where(and(isNull(units.deletedAt), eq(units.active, true)))
        .orderBy(units.callsign)
        .limit(120),

      db
        .select({ id: reports.id, reference: reports.reference, title: reports.title, status: reports.status, submittedAt: reports.submittedAt })
        .from(reports)
        .where(and(isNull(reports.deletedAt), gte(reports.submittedAt, since)))
        .orderBy(desc(reports.submittedAt!))
        .limit(50),
    ]);

    const priorityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const byPriority = priorityOrder
      .map((priority) => ({ priority, count: opened.filter((incident) => incident.priority === priority).length }))
      .filter((row) => row.count > 0);

    const activeCalls = callRows.filter((call) => !closedCalls.includes(call.status));

    return {
      generatedAt: new Date().toISOString(),
      operator: { id: ctx.user.id, name: ctx.user.name, jobTitle: ctx.user.jobTitle, username: ctx.user.username },
      period: { hours, since: since.toISOString(), until: new Date().toISOString() },
      summary: {
        incidentsOpened: opened.length,
        incidentsClosed: closed.length,
        incidentsStillOpen: openNow.length,
        callsReceived: callRows.length,
        callsStillActive: activeCalls.length,
        reportsSubmitted: reportRows.length,
        byPriority,
      },
      openIncidents: openNow.slice(0, 12).map((incident) => ({
        id: incident.id,
        reference: incident.reference,
        title: incident.title,
        priority: incident.priority,
        status: incident.status,
        location: incident.location,
        reportedAt: incident.reportedAt?.toISOString() ?? null,
      })),
      lookouts: notices[0],
      warrants: notices[1],
      alerts: notices[2],
      repeatInvolvement: repeat,
      units: {
        total: unitRows.length,
        available: unitRows.filter((unit) => unit.status === "AVAILABLE").length,
        committed: unitRows.filter((unit) => ["EN_ROUTE", "ON_SCENE", "BUSY"].includes(unit.status)).length,
        offAir: unitRows.filter((unit) => ["OUT_OF_SERVICE", "OFF_DUTY"].includes(unit.status)).length,
        roster: unitRows,
      },
      recentReports: reportRows.slice(0, 8),
    };
  },
};
