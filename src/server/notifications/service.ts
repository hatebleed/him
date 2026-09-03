import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { notificationPreferences, notifications } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { getOptionalContext } from "@/server/context";
import { publish } from "@/lib/realtime/bus";
import { getUserIdsWithPermission } from "@/server/permissions/service";

export type NotificationInput = {
  userId: string;
  type?: string;
  category?: string;
  priority?: string;
  title: string;
  message?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: unknown;
};

export type NotificationRecord = typeof notifications.$inferSelect;

/**
 * Central notification service. Every subsystem raises notifications through
 * this API so delivery, preferences and realtime fan-out stay in one place.
 */
class NotificationService {
  async send(input: NotificationInput): Promise<NotificationRecord | null> {
    const category = input.category ?? "SYSTEM";
    if (!(await this.isEnabled(input.userId, category))) return null;

    const [row] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type ?? "SYSTEM",
        category,
        priority: input.priority ?? "NORMAL",
        title: input.title,
        message: input.message ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        metadata: (input.metadata ?? null) as never,
      })
      .returning();

    if (row) {
      publish({
        type: "notification.created",
        userId: input.userId,
        payload: { id: row.id, title: row.title, category: row.category, createdAt: row.createdAt },
      });
    }
    return row ?? null;
  }

  async sendToMany(userIds: string[], input: Omit<NotificationInput, "userId">): Promise<number> {
    const unique = Array.from(new Set(userIds));
    let sent = 0;
    for (const userId of unique) {
      try {
        const result = await this.send({ ...input, userId });
        if (result) sent += 1;
      } catch (error) {
        logger.error("Notification delivery failed", { userId, error: (error as Error).message });
      }
    }
    return sent;
  }

  /** Notifies every active user holding a permission (e.g. report approvers). */
  async notifyPermission(permission: string, input: Omit<NotificationInput, "userId">): Promise<number> {
    const userIds = await getUserIdsWithPermission(permission);
    return this.sendToMany(userIds, input);
  }

  private async isEnabled(userId: string, category: string): Promise<boolean> {
    const [preference] = await db
      .select({ inApp: notificationPreferences.inApp })
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.category, category)))
      .limit(1);
    return preference?.inApp ?? true;
  }

  async listForUser(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}) {
    const limit = Math.min(100, options.limit ?? 20);
    const filters = [eq(notifications.userId, userId)];
    if (options.unreadOnly) filters.push(isNull(notifications.readAt));
    return db
      .select()
      .from(notifications)
      .where(and(...filters))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return Number(row?.count ?? 0);
  }

  /** Marks one notification read, scoped to its owner (prevents IDOR). */
  async markRead(userId: string, id: string): Promise<boolean> {
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return updated.length > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return updated.length;
  }

  async preferences(userId: string) {
    return db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  }

  async setPreference(userId: string, category: string, values: { inApp?: boolean; email?: boolean }) {
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.category, category)))
      .limit(1);
    if (existing[0]) {
      const [row] = await db
        .update(notificationPreferences)
        .set(values)
        .where(eq(notificationPreferences.id, existing[0].id))
        .returning();
      return row ?? null;
    }
    const [row] = await db
      .insert(notificationPreferences)
      .values({ userId, category, inApp: values.inApp ?? true, email: values.email ?? false })
      .returning();
    return row ?? null;
  }

  /** Convenience wrapper used by services: notify the acting user's supervisors. */
  async notifySupervisors(input: Omit<NotificationInput, "userId">): Promise<number> {
    return this.notifyPermission("reports.approve", input);
  }
}

export const notificationService = new NotificationService();

/** Notifies the current actor only when it is someone else (avoids self-spam). */
export function shouldSelfNotify(): boolean {
  return getOptionalContext() !== null;
}
