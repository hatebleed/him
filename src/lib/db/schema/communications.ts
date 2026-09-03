import { relations } from "drizzle-orm";
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { departments, units } from "./organisation";
import { createdAt, id, updatedAt } from "./shared";

export const channelTypeEnum = pgEnum("channel_type", ["DIRECT", "GROUP", "DEPARTMENT", "UNIT", "INCIDENT"]);

export const channels = pgTable(
  "channels",
  {
    id: id(),
    name: text("name").notNull(),
    type: channelTypeEnum("type").notNull().default("GROUP"),
    topic: text("topic"),
    departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
    unitId: text("unit_id").references(() => units.id, { onDelete: "set null" }),
    incidentId: text("incident_id"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("channels_type_idx").on(table.type),
    index("channels_unit_idx").on(table.unitId),
    index("channels_department_idx").on(table.departmentId),
  ],
);

export const channelMembers = pgTable(
  "channel_members",
  {
    id: id(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("MEMBER"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true, mode: "date" }),
    muted: boolean("muted").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("channel_member_unique").on(table.channelId, table.userId),
    index("channel_member_user_idx").on(table.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    mentions: jsonb("mentions").$type<string[]>(),
    editedAt: timestamp("edited_at", { withTimezone: true, mode: "date" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    parentId: text("parent_id"),
    createdAt: createdAt(),
  },
  (table) => [
    index("messages_channel_idx").on(table.channelId, table.createdAt),
    index("messages_author_idx").on(table.authorId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("SYSTEM"),
    category: text("category").notNull().default("SYSTEM"),
    priority: text("priority").notNull().default("NORMAL"),
    title: text("title").notNull(),
    message: text("message"),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.readAt),
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    index("notifications_category_idx").on(table.category),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    inApp: boolean("in_app").notNull().default(true),
    email: boolean("email").notNull().default(false),
  },
  (table) => [uniqueIndex("notification_preference_unique").on(table.userId, table.category)],
);

export const channelsRelations = relations(channels, ({ many, one }) => ({
  department: one(departments, { fields: [channels.departmentId], references: [departments.id] }),
  unit: one(units, { fields: [channels.unitId], references: [units.id] }),
  members: many(channelMembers),
  messages: many(messages),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, { fields: [channelMembers.channelId], references: [channels.id] }),
  user: one(users, { fields: [channelMembers.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  channel: one(channels, { fields: [messages.channelId], references: [channels.id] }),
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export type Channel = typeof channels.$inferSelect;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
