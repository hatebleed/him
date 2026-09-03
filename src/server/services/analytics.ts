import "server-only";

import { and, count, desc, eq, gte, inArray, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";
import { alerts, evidence, incidents, reports, tasks, timelineEntries, units } from "@/lib/db/schema";
import { assertCan, type RequestContext } from "@/server/context";
import { getClosedStatuses } from "@/server/configuration/service";

/**
 * Analytics framework.
 *
 * Metrics are defined once here and referenced by dashboard widgets by key,
 * so new widgets do not require UI changes and the UI never hard-codes a
 * metric.
 */
export type MetricResult = { key: string; label: string; value: number; hint?: string; trend?: number[] };

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function countWhere(table: PgTable, conditions: SQL | undefined): Promise<number> {
  const [row] = await db.select({ value: count() }).from(table).where(conditions);
  return Number(row?.value ?? 0);
}

export const analyticsService = {
  async metrics(ctx: RequestContext, keys: string[]): Promise<Record<string, MetricResult>> {
    assertCan(ctx, "analytics.view");
    const closedIncidents = await getClosedStatuses("incident");
    const closedTasks = await getClosedStatuses("task");
    const result: Record<string, MetricResult> = {};

    const tasks_: Array<[string, () => Promise<MetricResult>]> = [
      [
        "activeIncidents",
        async () => ({
          key: "activeIncidents",
          label: "Active incidents",
          value: await countWhere(incidents, and(isNull(incidents.deletedAt), closedIncidents.length ? notInArray(incidents.status, closedIncidents) : undefined)),
          hint: "Incidents not in a closed status",
        }),
      ],
      [
        "openTasks",
        async () => ({
          key: "openTasks",
          label: "My open tasks",
          value: await countWhere(tasks, and(eq(tasks.assigneeId, ctx.user.id), isNull(tasks.deletedAt), closedTasks.length ? notInArray(tasks.status, closedTasks) : undefined)),
          hint: "Assigned to you",
        }),
      ],
      [
        "overdueTasks",
        async () => ({
          key: "overdueTasks",
          label: "Overdue tasks",
          value: await countWhere(tasks, and(isNull(tasks.deletedAt), sql`${tasks.dueAt} is not null and ${tasks.dueAt} < now() and ${tasks.completedAt} is null`)),
          hint: "Past their due date",
        }),
      ],
      [
        "activeUnits",
        async () => ({ key: "activeUnits", label: "Available units", value: await countWhere(units, and(isNull(units.deletedAt), eq(units.status, "AVAILABLE"))), hint: "Units ready for assignment" }),
      ],
      [
        "pendingReports",
        async () => ({
          key: "pendingReports",
          label: "Reports pending",
          value: await countWhere(reports, and(isNull(reports.deletedAt), inArray(reports.status, ["SUBMITTED", "UNDER_REVIEW"]))),
          hint: "Submitted or under review",
        }),
      ],
      [
        "evidenceInCustody",
        async () => ({ key: "evidenceInCustody", label: "Evidence in custody", value: await countWhere(evidence, and(isNull(evidence.deletedAt), eq(evidence.status, "IN_CUSTODY"))) }),
      ],
      [
        "activeAlerts",
        async () => ({ key: "activeAlerts", label: "Active alerts", value: await countWhere(alerts, and(isNull(alerts.deletedAt), eq(alerts.status, "ACTIVE"))) }),
      ],
      [
        "incidentsThisWeek",
        async () => ({
          key: "incidentsThisWeek",
          label: "New incidents (7d)",
          value: await countWhere(incidents, and(isNull(incidents.deletedAt), gte(incidents.createdAt, daysAgo(7)))),
        }),
      ],
    ];

    for (const [key, loader] of tasks_) {
      if (!keys.includes(key)) continue;
      result[key] = await loader();
    }
    return result;
  },

  async incidentTrend(ctx: RequestContext, days = 14) {
    assertCan(ctx, "analytics.view");
    const rows = await db
      .select({ day: sql<string>`to_char(date_trunc('day', ${incidents.createdAt}), 'YYYY-MM-DD')`, value: count() })
      .from(incidents)
      .where(and(isNull(incidents.deletedAt), gte(incidents.createdAt, daysAgo(days))))
      .groupBy(sql`date_trunc('day', ${incidents.createdAt})`)
      .orderBy(sql`date_trunc('day', ${incidents.createdAt})`);
    return rows.map((row) => ({ label: row.day, value: Number(row.value) }));
  },

  async incidentPriorityDistribution(ctx: RequestContext) {
    assertCan(ctx, "analytics.view");
    const closed = await getClosedStatuses("incident");
    const rows = await db
      .select({ priority: incidents.priority, value: count() })
      .from(incidents)
      .where(and(isNull(incidents.deletedAt), closed.length ? notInArray(incidents.status, closed) : undefined))
      .groupBy(incidents.priority);
    return rows.map((row) => ({ label: row.priority, value: Number(row.value) }));
  },

  /** Recent records the user is allowed to see, for the dashboard feed. */
  async recentRecords(ctx: RequestContext, limit = 8) {
    assertCan(ctx, "dashboard.view");
    const rows = await db
      .select({
        id: incidents.id,
        reference: incidents.reference,
        title: incidents.title,
        status: incidents.status,
        priority: incidents.priority,
        createdAt: incidents.createdAt,
      })
      .from(incidents)
      .where(isNull(incidents.deletedAt))
      .orderBy(desc(incidents.createdAt))
      .limit(limit);
    return rows;
  },

  async recentActivity(ctx: RequestContext, limit = 10) {
    assertCan(ctx, "timeline.view");
    return db
      .select({
        id: timelineEntries.id,
        recordType: timelineEntries.recordType,
        recordId: timelineEntries.recordId,
        type: timelineEntries.type,
        message: timelineEntries.message,
        actorName: timelineEntries.actorName,
        occurredAt: timelineEntries.occurredAt,
      })
      .from(timelineEntries)
      .orderBy(desc(timelineEntries.occurredAt))
      .limit(limit);
  },
};
