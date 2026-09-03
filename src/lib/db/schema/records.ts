import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { cases, incidents } from "./operations";
import { persons, vehicles } from "./organisation";
import { createdAt, createdBy, id, softDelete, updatedAt, updatedBy } from "./shared";

// ---------------------------------------------------------------------------
// Reports (with immutable version history)
// ---------------------------------------------------------------------------

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("DRAFT"),
    currentVersion: integer("current_version").notNull().default(1),
    incidentId: text("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    caseId: text("case_id").references(() => cases.id, { onDelete: "set null" }),
    categoryId: text("category_id"),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewerId: text("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    rejectionReason: text("rejection_reason"),
    formData: jsonb("form_data"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: createdBy().references(() => users.id, { onDelete: "set null" }),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("reports_reference_unique").on(table.reference),
    index("reports_status_idx").on(table.status),
    index("reports_author_idx").on(table.authorId),
    index("reports_incident_idx").on(table.incidentId),
    index("reports_case_idx").on(table.caseId),
    index("reports_deleted_idx").on(table.deletedAt),
    index("reports_created_idx").on(table.createdAt),
  ],
);

export const reportVersions = pgTable(
  "report_versions",
  {
    id: id(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data"),
    changeNote: text("change_note"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("report_version_unique").on(table.reportId, table.version),
    index("report_version_report_idx").on(table.reportId),
  ],
);

// ---------------------------------------------------------------------------
// Warrants / alerts / BOLOs
// ---------------------------------------------------------------------------

export const warrants = pgTable(
  "warrants",
  {
    id: id(),
    reference: text("reference").notNull(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("ARREST"),
    status: text("status").notNull().default("ACTIVE"),
    description: text("description"),
    issuingAuthority: text("issuing_authority"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: createdBy().references(() => users.id, { onDelete: "set null" }),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("warrants_reference_unique").on(table.reference),
    index("warrants_person_idx").on(table.personId),
    index("warrants_status_idx").on(table.status),
    index("warrants_expires_idx").on(table.expiresAt),
    index("warrants_deleted_idx").on(table.deletedAt),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: id(),
    reference: text("reference").notNull(),
    type: text("type").notNull().default("GENERAL"),
    subject: text("subject").notNull(),
    description: text("description"),
    priority: text("priority").notNull().default("MEDIUM"),
    status: text("status").notNull().default("ACTIVE"),
    categoryId: text("category_id"),
    personId: text("person_id").references(() => persons.id, { onDelete: "set null" }),
    vehicleId: text("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    incidentId: text("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: "date" }),
    acknowledgedById: text("acknowledged_by_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: createdBy().references(() => users.id, { onDelete: "set null" }),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("alerts_reference_unique").on(table.reference),
    index("alerts_status_idx").on(table.status),
    index("alerts_priority_idx").on(table.priority),
    index("alerts_type_idx").on(table.type),
    index("alerts_deleted_idx").on(table.deletedAt),
    index("alerts_created_idx").on(table.createdAt),
  ],
);

export const bolos = pgTable(
  "bolos",
  {
    id: id(),
    reference: text("reference").notNull(),
    subject: text("subject").notNull(),
    description: text("description"),
    status: text("status").notNull().default("ACTIVE"),
    priority: text("priority").notNull().default("MEDIUM"),
    personId: text("person_id").references(() => persons.id, { onDelete: "set null" }),
    vehicleId: text("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    incidentId: text("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: createdBy().references(() => users.id, { onDelete: "set null" }),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("bolos_reference_unique").on(table.reference),
    index("bolos_status_idx").on(table.status),
    index("bolos_priority_idx").on(table.priority),
    index("bolos_deleted_idx").on(table.deletedAt),
  ],
);

// ---------------------------------------------------------------------------
// Evidence / property
// ---------------------------------------------------------------------------

export const evidence = pgTable(
  "evidence",
  {
    id: id(),
    itemNumber: text("item_number").notNull(),
    description: text("description").notNull(),
    categoryId: text("category_id"),
    quantity: integer("quantity").notNull().default(1),
    unitLabel: text("unit_label"),
    location: text("location"),
    status: text("status").notNull().default("IN_CUSTODY"),
    incidentId: text("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    custodianId: text("custodian_id").references(() => users.id, { onDelete: "set null" }),
    collectedAt: timestamp("collected_at", { withTimezone: true, mode: "date" }),
    collectedFrom: text("collected_from"),
    notes: text("notes"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: createdBy().references(() => users.id, { onDelete: "set null" }),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("evidence_item_number_unique").on(table.itemNumber),
    index("evidence_status_idx").on(table.status),
    index("evidence_incident_idx").on(table.incidentId),
    index("evidence_custodian_idx").on(table.custodianId),
    index("evidence_deleted_idx").on(table.deletedAt),
  ],
);

/** Custody / movement events. Append-only: never updated, never deleted. */
export const evidenceEvents = pgTable(
  "evidence_events",
  {
    id: id(),
    evidenceId: text("evidence_id")
      .notNull()
      .references(() => evidence.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("TRANSFER"),
    fromLocation: text("from_location"),
    toLocation: text("to_location"),
    fromCustodianId: text("from_custodian_id").references(() => users.id, { onDelete: "set null" }),
    toCustodianId: text("to_custodian_id").references(() => users.id, { onDelete: "set null" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("evidence_event_evidence_idx").on(table.evidenceId), index("evidence_event_occurred_idx").on(table.occurredAt)],
);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("OPEN"),
    priority: text("priority").notNull().default("MEDIUM"),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    creatorId: text("creator_id").references(() => users.id, { onDelete: "set null" }),
    departmentId: text("department_id"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    recordType: text("record_type"),
    recordId: text("record_id"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("tasks_reference_unique").on(table.reference),
    index("tasks_status_idx").on(table.status),
    index("tasks_assignee_idx").on(table.assigneeId),
    index("tasks_due_idx").on(table.dueAt),
    index("tasks_record_idx").on(table.recordType, table.recordId),
    index("tasks_deleted_idx").on(table.deletedAt),
  ],
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("task_comment_task_idx").on(table.taskId)],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const reportsRelations = relations(reports, ({ many, one }) => ({
  author: one(users, { fields: [reports.authorId], references: [users.id] }),
  reviewer: one(users, { fields: [reports.reviewerId], references: [users.id] }),
  incident: one(incidents, { fields: [reports.incidentId], references: [incidents.id] }),
  case: one(cases, { fields: [reports.caseId], references: [cases.id] }),
  versions: many(reportVersions),
}));

export const reportVersionsRelations = relations(reportVersions, ({ one }) => ({
  report: one(reports, { fields: [reportVersions.reportId], references: [reports.id] }),
}));

export const warrantsRelations = relations(warrants, ({ one }) => ({
  person: one(persons, { fields: [warrants.personId], references: [persons.id] }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  person: one(persons, { fields: [alerts.personId], references: [persons.id] }),
  vehicle: one(vehicles, { fields: [alerts.vehicleId], references: [vehicles.id] }),
  incident: one(incidents, { fields: [alerts.incidentId], references: [incidents.id] }),
}));

export const bolosRelations = relations(bolos, ({ one }) => ({
  person: one(persons, { fields: [bolos.personId], references: [persons.id] }),
  vehicle: one(vehicles, { fields: [bolos.vehicleId], references: [vehicles.id] }),
  incident: one(incidents, { fields: [bolos.incidentId], references: [incidents.id] }),
}));

export const evidenceRelations = relations(evidence, ({ many, one }) => ({
  incident: one(incidents, { fields: [evidence.incidentId], references: [incidents.id] }),
  custodian: one(users, { fields: [evidence.custodianId], references: [users.id] }),
  events: many(evidenceEvents),
}));

export const evidenceEventsRelations = relations(evidenceEvents, ({ one }) => ({
  evidence: one(evidence, { fields: [evidenceEvents.evidenceId], references: [evidence.id] }),
  actor: one(users, { fields: [evidenceEvents.actorId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ many, one }) => ({
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  creator: one(users, { fields: [tasks.creatorId], references: [users.id] }),
  comments: many(taskComments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
  author: one(users, { fields: [taskComments.authorId], references: [users.id] }),
}));

export type Report = typeof reports.$inferSelect;
export type ReportVersion = typeof reportVersions.$inferSelect;
export type Warrant = typeof warrants.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Bolo = typeof bolos.$inferSelect;
export type EvidenceItem = typeof evidence.$inferSelect;
export type EvidenceEvent = typeof evidenceEvents.$inferSelect;
export type Task = typeof tasks.$inferSelect;
