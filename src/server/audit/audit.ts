import "server-only";

import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { auditLogs, timelineEntries, users } from "@/lib/db/schema";
import { getOptionalContext } from "@/server/context";

export type AuditInput = {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  summary?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
};

function serialise(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as unknown;
  } catch {
    return null;
  }
}

/**
 * Writes an append-only audit entry. Audit rows are never updated or deleted
 * through application code, and only administrators holding `admin.audit.view`
 * can read them.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  const context = getOptionalContext();
  await db.insert(auditLogs).values({
    actorId: context?.user.id ?? null,
    actorName: context?.user.name ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    summary: input.summary ?? null,
    previousValue: serialise(input.previousValue),
    newValue: serialise(input.newValue),
    metadata: serialise(input.metadata),
    ip: context?.ip ?? null,
    userAgent: context?.userAgent ?? null,
    requestId: context?.requestId ?? null,
  });
}

export type TimelineInput = {
  recordType: string;
  recordId: string;
  type?: string;
  message: string;
  metadata?: unknown;
  occurredAt?: Date;
};

/** Appends an entry to a record's timeline. */
export async function recordTimeline(input: TimelineInput): Promise<void> {
  const context = getOptionalContext();
  await db.insert(timelineEntries).values({
    recordType: input.recordType,
    recordId: input.recordId,
    type: input.type ?? "SYSTEM",
    message: input.message,
    actorId: context?.user.id ?? null,
    actorName: context?.user.name ?? null,
    metadata: serialise(input.metadata),
    occurredAt: input.occurredAt ?? new Date(),
  });
}

export type AuditQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
  resourceType?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
};

export async function searchAuditLogs(query: AuditQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 25));
  const filters: SQL[] = [];

  if (query.action) filters.push(eq(auditLogs.action, query.action));
  if (query.resourceType) filters.push(eq(auditLogs.resourceType, query.resourceType));
  if (query.actorId) filters.push(eq(auditLogs.actorId, query.actorId));
  if (query.from) filters.push(gte(auditLogs.createdAt, query.from));
  if (query.to) filters.push(lte(auditLogs.createdAt, query.to));
  if (query.search) {
    const term = `%${query.search}%`;
    const searchFilter = or(
      ilike(auditLogs.summary, term),
      ilike(auditLogs.action, term),
      ilike(auditLogs.resourceType, term),
      ilike(auditLogs.resourceId, term),
      ilike(auditLogs.actorName, term),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  const where = filters.length ? and(...filters) : undefined;
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      summary: auditLogs.summary,
      actorName: auditLogs.actorName,
      actorId: auditLogs.actorId,
      ip: auditLogs.ip,
      metadata: auditLogs.metadata,
      previousValue: auditLogs.previousValue,
      newValue: auditLogs.newValue,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count } = { count: 0 }] = await db
    .select({ count: sqlCount() })
    .from(auditLogs)
    .where(where);

  return { rows, total: Number(count ?? 0), page, pageSize };
}

function sqlCount() {
  return sql<number>`count(*)::int`.as("count");
}

export async function getRecordTimeline(recordType: string, recordId: string, limit = 100) {
  return db
    .select({
      id: timelineEntries.id,
      type: timelineEntries.type,
      message: timelineEntries.message,
      actorName: timelineEntries.actorName,
      metadata: timelineEntries.metadata,
      occurredAt: timelineEntries.occurredAt,
      actorAvatar: users.avatarUrl,
    })
    .from(timelineEntries)
    .leftJoin(users, eq(users.id, timelineEntries.actorId))
    .where(and(eq(timelineEntries.recordType, recordType), eq(timelineEntries.recordId, recordId)))
    .orderBy(desc(timelineEntries.occurredAt))
    .limit(limit);
}

export async function getRecentAuditActions(actions: string[], limit = 10) {
  if (actions.length === 0) return [];
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      summary: auditLogs.summary,
      actorName: auditLogs.actorName,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(inArray(auditLogs.action, actions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
