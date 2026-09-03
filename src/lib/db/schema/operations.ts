import { relations } from "drizzle-orm";
import { doublePrecision, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { departments, persons, units, vehicles } from "./organisation";
import { createdAt, createdBy, id, softDelete, updatedAt, updatedBy } from "./shared";

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export const incidents = pgTable(
  "incidents",
  {
    id: id(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("NEW"),
    priority: text("priority").notNull().default("MEDIUM"),
    categoryId: text("category_id"),
    departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
    location: text("location"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    reportedAt: timestamp("reported_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    supervisorId: text("supervisor_id").references(() => users.id, { onDelete: "set null" }),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: createdBy().references(() => users.id, { onDelete: "set null" }),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("incidents_reference_unique").on(table.reference),
    index("incidents_status_idx").on(table.status),
    index("incidents_priority_idx").on(table.priority),
    index("incidents_reported_idx").on(table.reportedAt),
    index("incidents_department_idx").on(table.departmentId),
    index("incidents_deleted_idx").on(table.deletedAt),
  ],
);

export const incidentParticipants = pgTable(
  "incident_participants",
  {
    id: id(),
    incidentId: text("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("INVOLVED"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("incident_participant_unique").on(table.incidentId, table.personId, table.role),
    index("incident_participant_person_idx").on(table.personId),
  ],
);

export const incidentVehicles = pgTable(
  "incident_vehicles",
  {
    id: id(),
    incidentId: text("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("INVOLVED"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("incident_vehicle_unique").on(table.incidentId, table.vehicleId, table.role),
    index("incident_vehicle_vehicle_idx").on(table.vehicleId),
  ],
);

export const incidentAssignments = pgTable(
  "incident_assignments",
  {
    id: id(),
    incidentId: text("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    unitId: text("unit_id").references(() => units.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    role: text("role").notNull().default("ASSIGNED"),
    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    clearedAt: timestamp("cleared_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
  },
  (table) => [
    index("incident_assignment_incident_idx").on(table.incidentId),
    index("incident_assignment_unit_idx").on(table.unitId),
    index("incident_assignment_user_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export const cases = pgTable(
  "cases",
  {
    id: id(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("OPEN"),
    priority: text("priority").notNull().default("MEDIUM"),
    categoryId: text("category_id"),
    departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
    leadId: text("lead_id").references(() => users.id, { onDelete: "set null" }),
    openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    reviewNotes: text("review_notes"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: createdBy().references(() => users.id, { onDelete: "set null" }),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("cases_reference_unique").on(table.reference),
    index("cases_status_idx").on(table.status),
    index("cases_priority_idx").on(table.priority),
    index("cases_department_idx").on(table.departmentId),
    index("cases_deleted_idx").on(table.deletedAt),
  ],
);

export const caseIncidents = pgTable(
  "case_incidents",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    incidentId: text("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("case_incident_unique").on(table.caseId, table.incidentId),
    index("case_incident_incident_idx").on(table.incidentId),
  ],
);

// ---------------------------------------------------------------------------
// Dispatch calls
// ---------------------------------------------------------------------------

export const calls = pgTable(
  "calls",
  {
    id: id(),
    reference: text("reference").notNull(),
    type: text("type").notNull().default("GENERAL"),
    priority: text("priority").notNull().default("MEDIUM"),
    status: text("status").notNull().default("PENDING"),
    description: text("description"),
    location: text("location"),
    callerName: text("caller_name"),
    callerPhone: text("caller_phone"),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true, mode: "date" }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    incidentId: text("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
    receivedById: text("received_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("calls_reference_unique").on(table.reference),
    index("calls_status_idx").on(table.status),
    index("calls_priority_idx").on(table.priority),
    index("calls_received_idx").on(table.receivedAt),
  ],
);

export const callUnits = pgTable(
  "call_units",
  {
    id: id(),
    callId: text("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    unitId: text("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("ASSIGNED"),
    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    arrivedAt: timestamp("arrived_at", { withTimezone: true, mode: "date" }),
    clearedAt: timestamp("cleared_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [uniqueIndex("call_unit_unique").on(table.callId, table.unitId), index("call_unit_unit_idx").on(table.unitId)],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const incidentsRelations = relations(incidents, ({ many, one }) => ({
  department: one(departments, { fields: [incidents.departmentId], references: [departments.id] }),
  supervisor: one(users, { fields: [incidents.supervisorId], references: [users.id] }),
  participants: many(incidentParticipants),
  vehicles: many(incidentVehicles),
  assignments: many(incidentAssignments),
  calls: many(calls),
}));

export const incidentParticipantsRelations = relations(incidentParticipants, ({ one }) => ({
  incident: one(incidents, { fields: [incidentParticipants.incidentId], references: [incidents.id] }),
  person: one(persons, { fields: [incidentParticipants.personId], references: [persons.id] }),
}));

export const incidentVehiclesRelations = relations(incidentVehicles, ({ one }) => ({
  incident: one(incidents, { fields: [incidentVehicles.incidentId], references: [incidents.id] }),
  vehicle: one(vehicles, { fields: [incidentVehicles.vehicleId], references: [vehicles.id] }),
}));

export const incidentAssignmentsRelations = relations(incidentAssignments, ({ one }) => ({
  incident: one(incidents, { fields: [incidentAssignments.incidentId], references: [incidents.id] }),
  unit: one(units, { fields: [incidentAssignments.unitId], references: [units.id] }),
  user: one(users, { fields: [incidentAssignments.userId], references: [users.id] }),
}));

export const casesRelations = relations(cases, ({ many, one }) => ({
  department: one(departments, { fields: [cases.departmentId], references: [departments.id] }),
  lead: one(users, { fields: [cases.leadId], references: [users.id] }),
  incidents: many(caseIncidents),
}));

export const caseIncidentsRelations = relations(caseIncidents, ({ one }) => ({
  case: one(cases, { fields: [caseIncidents.caseId], references: [cases.id] }),
  incident: one(incidents, { fields: [caseIncidents.incidentId], references: [incidents.id] }),
}));

export const callsRelations = relations(calls, ({ many, one }) => ({
  incident: one(incidents, { fields: [calls.incidentId], references: [incidents.id] }),
  department: one(departments, { fields: [calls.departmentId], references: [departments.id] }),
  units: many(callUnits),
}));

export const callUnitsRelations = relations(callUnits, ({ one }) => ({
  call: one(calls, { fields: [callUnits.callId], references: [calls.id] }),
  unit: one(units, { fields: [callUnits.unitId], references: [units.id] }),
}));

export type Incident = typeof incidents.$inferSelect;
export type IncidentParticipant = typeof incidentParticipants.$inferSelect;
export type IncidentVehicle = typeof incidentVehicles.$inferSelect;
export type IncidentAssignment = typeof incidentAssignments.$inferSelect;
export type Case = typeof cases.$inferSelect;
export type Call = typeof calls.$inferSelect;