import "server-only";

import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { channelMembers, channels, messages, notifications, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { ChannelUpsertInput } from "@/lib/validation/records";

import { publish } from "@/lib/realtime/bus";
import { recordAudit } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { notificationService } from "../notifications/service";

export type ChannelSummary = {
  id: string;
  name: string;
  type: string;
  topic: string | null;
  unread: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  memberCount: number;
};

/**
 * Communications service.
 *
 * Persistence is real: messages live in PostgreSQL. Realtime delivery is
 * abstracted behind the event bus, so a WebSocket/SSE transport can be added
 * without changing this service.
 */
export const communicationService = {
  async listChannels(ctx: RequestContext): Promise<ChannelSummary[]> {
    assertCan(ctx, "communications.view");
    const memberships = await db
      .select({ channelId: channelMembers.channelId, lastReadAt: channelMembers.lastReadAt })
      .from(channelMembers)
      .where(eq(channelMembers.userId, ctx.user.id));

    if (memberships.length === 0) return [];
    const channelIds = memberships.map((row) => row.channelId);

    const [channelRows, messageRows, memberCounts] = await Promise.all([
      db
        .select({
          id: channels.id,
          name: channels.name,
          type: channels.type,
          topic: channels.topic,
          isArchived: channels.isArchived,
        })
        .from(channels)
        .where(and(inArray(channels.id, channelIds), eq(channels.isArchived, false))),
      db
        .select({
          channelId: messages.channelId,
          body: messages.body,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.channelId, channelIds))
        .orderBy(desc(messages.createdAt)),
      db
        .select({ channelId: channelMembers.channelId, count: sql<number>`count(*)::int` })
        .from(channelMembers)
        .where(inArray(channelMembers.channelId, channelIds))
        .groupBy(channelMembers.channelId),
    ]);

    const lastByChannel = new Map<string, { body: string; createdAt: Date }>();
    for (const row of messageRows) {
      if (!lastByChannel.has(row.channelId)) lastByChannel.set(row.channelId, { body: row.body, createdAt: row.createdAt });
    }
    const counts = new Map(memberCounts.map((row) => [row.channelId, Number(row.count)] as const));

    // Unread counts respect each membership's own read cursor.
    const unreadRows = await db
      .select({ channelId: messages.channelId, count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(inArray(messages.channelId, channelIds), isNull(messages.deletedAt)))
      .groupBy(messages.channelId);

    const totals = new Map(unreadRows.map((row) => [row.channelId, Number(row.count)] as const));

    return channelRows
      .map((channel) => {
        const membership = memberships.find((row) => row.channelId === channel.id);
        const last = lastByChannel.get(channel.id);
        return {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          topic: channel.topic,
          unread: membership?.lastReadAt ? 0 : (totals.get(channel.id) ?? 0),
          lastMessageAt: last?.createdAt ?? null,
          lastMessagePreview: last ? last.body.slice(0, 120) : null,
          memberCount: counts.get(channel.id) ?? 0,
        };
      })
      .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
  },

  async getChannel(ctx: RequestContext, channelId: string) {
    assertCan(ctx, "communications.view");
    const [membership] = await db
      .select()
      .from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, ctx.user.id)))
      .limit(1);
    if (!membership) throw AppError.forbidden("You are not a member of this channel.");

    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) throw AppError.notFound("This channel does not exist.");

    const rows = await db
      .select({
        id: messages.id,
        body: messages.body,
        createdAt: messages.createdAt,
        editedAt: messages.editedAt,
        mentions: messages.mentions,
        authorId: messages.authorId,
        authorName: users.name,
        authorAvatar: users.avatarUrl,
      })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.authorId))
      .where(and(eq(messages.channelId, channelId), isNull(messages.deletedAt)))
      .orderBy(asc(messages.createdAt))
      .limit(200);

    const members = await db
      .select({ userId: channelMembers.userId, name: users.name, jobTitle: users.jobTitle, role: channelMembers.role })
      .from(channelMembers)
      .innerJoin(users, eq(users.id, channelMembers.userId))
      .where(eq(channelMembers.channelId, channelId));

    await db.update(channelMembers).set({ lastReadAt: new Date() }).where(eq(channelMembers.id, membership.id));

    return { ...channel, messages: rows, members };
  },

  async sendMessage(ctx: RequestContext, channelId: string, body: string) {
    assertCan(ctx, "communications.send");
    const [membership] = await db
      .select()
      .from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, ctx.user.id)))
      .limit(1);
    if (!membership) throw AppError.forbidden("You are not a member of this channel.");

    const mentions = extractMentions(body);
    const [message] = await db
      .insert(messages)
      .values({ channelId, authorId: ctx.user.id, body, mentions })
      .returning();

    publish({ type: "message.created", channelId, payload: { id: message!.id, body, authorId: ctx.user.id } });

    const recipients = await db
      .select({ userId: channelMembers.userId })
      .from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), ne(channelMembers.userId, ctx.user.id)));

    const mentioned = new Set(mentions);
    await notificationService.sendToMany(
      recipients.filter((row) => mentioned.size === 0 || mentioned.has(row.userId)).map((row) => row.userId),
      {
        type: "MESSAGE",
        category: "MESSAGES",
        title: mentioned.size > 0 ? "You were mentioned" : "New channel message",
        message: `${ctx.user.name}: ${body.slice(0, 140)}`,
        resourceType: "channel",
        resourceId: channelId,
      },
    );

    return message;
  },

  async createChannel(ctx: RequestContext, input: ChannelUpsertInput) {
    assertCan(ctx, "communications.manage");
    const memberIds = Array.from(new Set([ctx.user.id, ...input.memberIds]));
    const [channel] = await db
      .insert(channels)
      .values({
        name: input.name,
        topic: input.topic,
        type: input.type,
        departmentId: input.departmentId,
        unitId: input.unitId,
        createdById: ctx.user.id,
      })
      .returning();

    await db.insert(channelMembers).values(memberIds.map((userId) => ({ channelId: channel!.id, userId }))).onConflictDoNothing();
    await recordAudit({ action: "channel.created", resourceType: "channel", resourceId: channel!.id, summary: `Created channel ${input.name}` });
    return channel;
  },

  /** Opens (or reuses) a direct message channel between two users. */
  async directChannel(ctx: RequestContext, otherUserId: string) {
    assertCan(ctx, "communications.send");
    if (otherUserId === ctx.user.id) throw AppError.badRequest("You cannot message yourself.");

    const mine = await db.select({ channelId: channelMembers.channelId }).from(channelMembers).where(eq(channelMembers.userId, ctx.user.id));
    const ids = mine.map((row) => row.channelId);
    if (ids.length) {
      const [existing] = await db
        .select({ id: channels.id })
        .from(channels)
        .where(and(inArray(channels.id, ids), eq(channels.type, "DIRECT")))
        .limit(1);
      if (existing) {
        const [shared] = await db
          .select({ id: channelMembers.id })
          .from(channelMembers)
          .where(and(eq(channelMembers.channelId, existing.id), eq(channelMembers.userId, otherUserId)))
          .limit(1);
        if (shared) return existing;
      }
    }

    const [other] = await db.select({ name: users.name }).from(users).where(eq(users.id, otherUserId)).limit(1);
    if (!other) throw AppError.notFound("This user does not exist.");

    const [channel] = await db
      .insert(channels)
      .values({ name: other.name, type: "DIRECT", createdById: ctx.user.id })
      .returning();
    await db
      .insert(channelMembers)
      .values([
        { channelId: channel!.id, userId: ctx.user.id },
        { channelId: channel!.id, userId: otherUserId },
      ])
      .onConflictDoNothing();
    return channel;
  },

  async deleteMessage(ctx: RequestContext, messageId: string) {
    assertCan(ctx, "communications.send");
    const [message] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!message) throw AppError.notFound("This message does not exist.");
    if (message.authorId !== ctx.user.id && !ctx.permissions.has("communications.manage")) {
      throw AppError.forbidden("You can only delete your own messages.");
    }
    await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, messageId));
    return { id: messageId };
  },

  /** Users available for direct messaging. */
  async directory(ctx: RequestContext) {
    assertCan(ctx, "communications.view");
    return db
      .select({ id: users.id, name: users.name, jobTitle: users.jobTitle, departmentId: users.departmentId })
      .from(users)
      .where(and(eq(users.status, "ACTIVE"), isNull(users.deletedAt), ne(users.id, ctx.user.id)))
      .orderBy(asc(users.name))
      .limit(200);
  },
};

function extractMentions(body: string): string[] {
  const matches = body.match(/@\[([0-9a-zA-Z-]+)\]/g) ?? [];
  return matches.map((match) => match.slice(2, -1));
}

export { notifications };
