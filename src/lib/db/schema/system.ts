import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { createdAt, id, updatedAt } from "./shared";

/**
 * Generic, record-type agnostic infrastructure:
 * relationships, timeline, notes, attachments and the audit trail.
 * New record types plug into this without schema changes.
 */

export const recordRelationships = pgTable(
  "record_relationships",
  {
    id: id(),
    fromType: text("from_type").notNull(),
    fromId: text("from_id").notNull(),
    toType: text("to_type").notNull(),
    toId: text("to_id").notNull(),
    relationType: text("relation_type").notNull().default("RELATED"),
    metadata: jsonb("metadata"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("record_relationship_unique").on(table.fromType, table.fromId, table.toType, table.toId, table.relationType),
    index("record_relationship_from_idx").on(table.fromType, table.fromId),
    index("record_relationship_to_idx").on(table.toType, table.toId),
  ],
);

export const timelineEntries = pgTable(
  "timeline_entries",
  {
    id: id(),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    type: text("type").notNull().default("SYSTEM"),
    message: text("message").notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorName: text("actor_name"),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("timeline_record_idx").on(table.recordType, table.recordId, table.occurredAt)],
);

export const notes = pgTable(
  "notes",
  {
    id: id(),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("notes_record_idx").on(table.recordType, table.recordId)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    checksum: text("checksum").notNull(),
    description: text("description"),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    uploadedById: text("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("attachments_storage_key_unique").on(table.storageKey),
    index("attachments_record_idx").on(table.recordType, table.recordId),
  ],
);

/** Append-only audit trail. Rows are never updated or deleted through the app. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorName: text("actor_name"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    summary: text("summary"),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    metadata: jsonb("metadata"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_created_idx").on(table.createdAt),
    index("audit_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_actor_idx").on(table.actorId),
    index("audit_action_idx").on(table.action),
  ],
);

export const timelineEntriesRelations = relations(timelineEntries, ({ one }) => ({
  actor: one(users, { fields: [timelineEntries.actorId], references: [users.id] }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  author: one(users, { fields: [notes.authorId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export type RecordRelationship = typeof recordRelationships.$inferSelect;
export type TimelineEntry = typeof timelineEntries.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
