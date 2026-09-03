import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { createdAt, createdBy, id, softDelete, updatedAt, updatedBy } from "./shared";

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export const departments = pgTable(
  "departments",
  {
    id: id(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    parentId: text("parent_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("departments_name_unique").on(table.name),
    uniqueIndex("departments_code_unique").on(table.code),
    index("departments_active_idx").on(table.active),
  ],
);

// ---------------------------------------------------------------------------
// Vehicles (defined before units so unit -> vehicle foreign key resolves)
// ---------------------------------------------------------------------------

export const vehicles = pgTable(
  "vehicles",
  {
    id: id(),
    reference: text("reference").notNull(),
    registration: text("registration").notNull(),
    make: text("make"),
    model: text("model"),
    year: integer("year"),
    colour: text("colour"),
    bodyType: text("body_type"),
    fuelType: text("fuel_type"),
    vin: text("vin"),
    engineSize: text("engine_size"),
    status: text("status").notNull().default("ACTIVE"),
    categoryId: text("category_id"),
    departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
    notes: text("notes"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: createdBy().references(() => users.id, { onDelete: "set null" }),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("vehicles_reference_unique").on(table.reference),
    uniqueIndex("vehicles_registration_unique").on(table.registration),
    index("vehicles_status_idx").on(table.status),
    index("vehicles_registration_idx").on(table.registration),
    index("vehicles_department_idx").on(table.departmentId),
    index("vehicles_deleted_idx").on(table.deletedAt),
  ],
);

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export const units = pgTable(
  "units",
  {
    id: id(),
    name: text("name").notNull(),
    callsign: text("callsign").notNull(),
    departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
    status: text("status").notNull().default("AVAILABLE"),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true, mode: "date" }),
    statusNote: text("status_note"),
    location: text("location"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    vehicleId: text("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("units_callsign_unique").on(table.callsign),
    index("units_status_idx").on(table.status),
    index("units_department_idx").on(table.departmentId),
    index("units_deleted_idx").on(table.deletedAt),
  ],
);

export const unitMembers = pgTable(
  "unit_members",
  {
    id: id(),
    unitId: text("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("MEMBER"),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unit_member_unique").on(table.unitId, table.userId),
    index("unit_member_user_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const persons = pgTable(
  "persons",
  {
    id: id(),
    reference: text("reference").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    middleName: text("middle_name"),
    alias: text("alias"),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: true, mode: "date" }),
    gender: text("gender"),
    nationality: text("nationality"),
    occupation: text("occupation"),
    status: text("status").notNull().default("ACTIVE"),
    riskLevel: text("risk_level"),
    categoryId: text("category_id"),
    departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
    notes: text("notes"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: createdBy().references(() => users.id, { onDelete: "set null" }),
    updatedById: updatedBy().references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("persons_reference_unique").on(table.reference),
    index("persons_name_idx").on(table.lastName, table.firstName),
    index("persons_status_idx").on(table.status),
    index("persons_department_idx").on(table.departmentId),
    index("persons_deleted_idx").on(table.deletedAt),
    index("persons_created_idx").on(table.createdAt),
  ],
);

export const personIdentifiers = pgTable(
  "person_identifiers",
  {
    id: id(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("NATIONAL_ID"),
    value: text("value").notNull(),
    issuingAuthority: text("issuing_authority"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("person_identifier_unique").on(table.personId, table.type, table.value),
    index("person_identifier_value_idx").on(table.value),
  ],
);

export const personContacts = pgTable(
  "person_contacts",
  {
    id: id(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("EMAIL"),
    value: text("value").notNull(),
    label: text("label"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("person_contact_person_idx").on(table.personId), index("person_contact_value_idx").on(table.value)],
);

export const personAddresses = pgTable(
  "person_addresses",
  {
    id: id(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("HOME"),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    country: text("country"),
    isPrimary: boolean("is_primary").notNull().default(false),
    fromDate: timestamp("from_date", { withTimezone: true, mode: "date" }),
    toDate: timestamp("to_date", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("person_address_person_idx").on(table.personId)],
);

export const personVehicles = pgTable(
  "person_vehicles",
  {
    id: id(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("OWNER"),
    isPrimary: boolean("is_primary").notNull().default(false),
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }),
    endDate: timestamp("end_date", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("person_vehicle_unique").on(table.personId, table.vehicleId, table.relationship),
    index("person_vehicle_vehicle_idx").on(table.vehicleId),
  ],
);

// ---------------------------------------------------------------------------
// Relations (used by the typed relational query API)
// ---------------------------------------------------------------------------

export const departmentsRelations = relations(departments, ({ many }) => ({
  units: many(units),
  vehicles: many(vehicles),
  persons: many(persons),
}));

export const unitsRelations = relations(units, ({ many, one }) => ({
  department: one(departments, { fields: [units.departmentId], references: [departments.id] }),
  vehicle: one(vehicles, { fields: [units.vehicleId], references: [vehicles.id] }),
  members: many(unitMembers),
}));

export const unitMembersRelations = relations(unitMembers, ({ one }) => ({
  unit: one(units, { fields: [unitMembers.unitId], references: [units.id] }),
  user: one(users, { fields: [unitMembers.userId], references: [users.id] }),
}));

export const vehiclesRelations = relations(vehicles, ({ many, one }) => ({
  department: one(departments, { fields: [vehicles.departmentId], references: [departments.id] }),
  owners: many(personVehicles),
}));

export const personsRelations = relations(persons, ({ many, one }) => ({
  department: one(departments, { fields: [persons.departmentId], references: [departments.id] }),
  identifiers: many(personIdentifiers),
  contacts: many(personContacts),
  addresses: many(personAddresses),
  vehicles: many(personVehicles),
}));

export const personVehiclesRelations = relations(personVehicles, ({ one }) => ({
  person: one(persons, { fields: [personVehicles.personId], references: [persons.id] }),
  vehicle: one(vehicles, { fields: [personVehicles.vehicleId], references: [vehicles.id] }),
}));

export const personIdentifiersRelations = relations(personIdentifiers, ({ one }) => ({
  person: one(persons, { fields: [personIdentifiers.personId], references: [persons.id] }),
}));

export const personContactsRelations = relations(personContacts, ({ one }) => ({
  person: one(persons, { fields: [personContacts.personId], references: [persons.id] }),
}));

export const personAddressesRelations = relations(personAddresses, ({ one }) => ({
  person: one(persons, { fields: [personAddresses.personId], references: [persons.id] }),
}));

export type Department = typeof departments.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type UnitMember = typeof unitMembers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Person = typeof persons.$inferSelect;
export type PersonIdentifier = typeof personIdentifiers.$inferSelect;
export type PersonContact = typeof personContacts.$inferSelect;
export type PersonAddress = typeof personAddresses.$inferSelect;
export type PersonVehicle = typeof personVehicles.$inferSelect;
