/**
 * Development seed.
 *
 * Creates a complete, fictional but realistic operational dataset so the
 * platform can be explored end to end immediately after installation.
 * Everything here is invented data - no real personal data is used.
 *
 *   npm run db:seed     # idempotent-ish: skips when users already exist
 *   npm run db:reset    # drop schema, migrate, seed
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import { pool } from "../src/lib/db/client";
import { db } from "../src/lib/db/client";
import {
  alerts,
  auditLogs,
  bolos,
  calls,
  callUnits,
  cases,
  categoryDefinitions,
  channels,
  channelMembers,
  customFieldDefinitions,
  customFieldValues,
  dashboards,
  departments,
  dashboardWidgets,
  evidence,
  evidenceEvents,
  formFields,
  forms,
  incidents,
  incidentAssignments,
  incidentParticipants,
  incidentVehicles,
  messages,
  modules as modulesTable,
  navigationItems,
  notes,
  notifications,
  organisationSettings,
  persons,
  personAddresses,
  personContacts,
  personIdentifiers,
  personVehicles,
  permissions as permissionsTable,
  recordRelationships,
  reports,
  reportVersions,
  rolePermissions,
  roles,
  savedViews,
  statusDefinitions,
  systemSettings,
  tasks,
  taskComments,
  terminologyEntries,
  themeSettings,
  timelineEntries,
  units,
  unitMembers,
  userRoles,
  users,
  vehicles,
  warrants,
  workflowActions,
  workflowConditions,
  workflows,
} from "../src/lib/db/schema";
import { DEFAULT_CATEGORIES, DEFAULT_NAVIGATION, DEFAULT_ROLES, DEFAULT_STATUSES, DEFAULT_TERMINOLOGY, DEFAULT_DASHBOARD_WIDGETS } from "../src/config/defaults";
import { MODULE_DEFINITIONS } from "../src/config/modules";
import { PERMISSION_CATALOGUE } from "../src/config/permissions";
import { hashPassword } from "../src/lib/auth/password";

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "DemoPass123!";

// Deterministic pseudo-random generator so reseeding produces stable data.
let seedState = 20260901;
function random() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}
function randomInt(min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}
function daysAgo(days: number, hours = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - hours * 60 * 60 * 1000);
}
function maybe<T>(value: T, chance = 0.5): T | null {
  return random() < chance ? value : null;
}

const FIRST_NAMES = ["Ava", "Noah", "Mia", "Liam", "Zoe", "Ethan", "Isla", "Kai", "Nora", "Leo", "Ruby", "Omar", "Elena", "Jonas", "Priya", "Tomas", "Sofia", "Hugo", "Amara", "Felix"];
const LAST_NAMES = ["Mercer", "Whitfield", "Okoro", "Lindqvist", "Baptiste", "Nakamura", "Delgado", "Fenwick", "Rahman", "Kowalski", "Adeyemi", "Sorensen", "Villanueva", "Hartley", "Petrov", "Mbeki", "Larsen", "Fitzgerald", "Costa", "Novak"];
const STREETS = ["Harbour Road", "Linden Avenue", "Foundry Lane", "Cathedral Street", "Marlow Way", "Eastgate Terrace", "Quarry Road", "Beaconsfield Drive", "Sycamore Grove", "Ivybank Close"];
const CITIES = ["Northgate", "Ashcombe", "Ridgeway", "Silverport", "Kestrel Bay"];
const VEHICLE_MAKES = ["Volvo", "Toyota", "Ford", "Skoda", "Nissan", "Hyundai", "Peugeot", "Vauxhall", "BMW", "Renault"];
const VEHICLE_MODELS = ["XC60", "Corolla", "Transit", "Octavia", "Qashqai", "i30", "308", "Astra", "X3", "Clio"];
const COLOURS = ["Silver", "Black", "White", "Blue", "Grey", "Red", "Green"];
const INCIDENT_TITLES = [
  "Vehicle collision at junction",
  "Reported theft from commercial premises",
  "Missing person welfare check",
  "Burglary at residential property",
  "Fraudulent transaction reported",
  "Damage to property",
  "Suspicious vehicle reported",
  "Assault reported outside venue",
  "Recovered stolen vehicle",
  "Noise complaint escalation",
  "Road traffic obstruction",
  "Lost property enquiry",
  "Cyber-enabled fraud report",
  "Welfare concern raised by neighbour",
  "Theft of bicycle",
  "Graffiti and criminal damage",
  "Drug paraphernalia found",
  "Public order incident",
  "Abandoned vehicle report",
  "Witness appeal follow-up",
];
const REPORT_TITLES = [
  "Initial incident report",
  "Supplementary witness statement",
  "Scene examination notes",
  "Follow-up enquiry record",
  "Daily summary of activity",
  "Property inventory record",
  "Interview record",
  "Closure summary",
];
const BOLO_SUBJECTS = [
  "Silver estate believed used in burglary",
  "Male wearing distinctive jacket",
  "Missing juvenile last seen near harbour",
  "Van with partially obscured plate",
];
const ALERT_SUBJECTS = [
  "Severe weather expected overnight",
  "Road closure on Eastgate Terrace",
  "System maintenance window",
  "High-priority warrant issued",
  "Repeat incidents in Northgate district",
  "Officer safety reminder",
];

function reference(prefix: string, index: number) {
  const year = new Date().getUTCFullYear();
  return `${prefix}-${year}-${String(index).padStart(5, "0")}`;
}

export async function seed() {
  const [existing] = await db.select({ id: users.id }).from(users).limit(1);
  if (existing) {
    console.log("Seed skipped: users already exist. Run `npm run db:reset` to rebuild.");
    return;
  }

  console.log("Seeding permissions and roles...");
  const permissionRows = await db
    .insert(permissionsTable)
    .values(PERMISSION_CATALOGUE.map((permission) => ({
      key: permission.key,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      category: permission.category,
    })))
    .onConflictDoNothing()
    .returning();
  const permissionIdByKey = new Map(permissionRows.map((row) => [row.key, row.id] as const));

  const roleRows = await db
    .insert(roles)
    .values(
      DEFAULT_ROLES.map((role, index) => ({
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.key === "administrator",
        isDefault: role.isDefault ?? false,
        sortOrder: index,
      })),
    )
    .onConflictDoNothing()
    .returning();
  const roleIdByKey = new Map(roleRows.map((row) => [row.key, row.id] as const));

  const allPermissionKeys = PERMISSION_CATALOGUE.map((permission) => permission.key);
  for (const role of DEFAULT_ROLES) {
    const roleId = roleIdByKey.get(role.key);
    if (!roleId) continue;
    const keys = role.permissions === "all" ? allPermissionKeys : role.permissions;
    const values = keys
      .map((key) => permissionIdByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId, permissionId }));
    if (values.length) await db.insert(rolePermissions).values(values).onConflictDoNothing();
  }

  console.log("Seeding organisation, users and units...");
  const departmentRows = await db
    .insert(departments)
    .values([
      { name: "Operations", code: "OPS", description: "Front-line operational delivery." },
      { name: "Investigations", code: "INV", description: "Casework and follow-up enquiries." },
      { name: "Support Services", code: "SUP", description: "Logistics, records and administration." },
    ])
    .returning();
  const departmentIdByCode = new Map(departmentRows.map((row) => [row.code, row.id] as const));

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const userSpecs: Array<{ username: string; name: string; email: string; role: string; department: string; jobTitle: string; badge: string }> = [
    { username: "admin", name: "Dana Whitfield", email: "admin@him.local", role: "administrator", department: "OPS", jobTitle: "System Administrator", badge: "ADM-001" },
    { username: "supervisor1", name: "Marcus Bell", email: "supervisor1@him.local", role: "supervisor", department: "OPS", jobTitle: "Operations Supervisor", badge: "SUP-101" },
    { username: "supervisor2", name: "Priya Raman", email: "supervisor2@him.local", role: "supervisor", department: "INV", jobTitle: "Investigations Supervisor", badge: "SUP-102" },
    { username: "operator1", name: "Tomas Nowak", email: "operator1@him.local", role: "operator", department: "OPS", jobTitle: "Control Room Operator", badge: "OPR-201" },
    { username: "operator2", name: "Elena Petrova", email: "operator2@him.local", role: "operator", department: "OPS", jobTitle: "Control Room Operator", badge: "OPR-202" },
    { username: "analyst1", name: "Jonas Lindqvist", email: "analyst1@him.local", role: "standard", department: "INV", jobTitle: "Analyst", badge: "ANA-301" },
    { username: "officer1", name: "Amara Mbeki", email: "officer1@him.local", role: "standard", department: "OPS", jobTitle: "Response Officer", badge: "OFF-401" },
    { username: "officer2", name: "Felix Hartley", email: "officer2@him.local", role: "standard", department: "OPS", jobTitle: "Response Officer", badge: "OFF-402" },
    { username: "readonly", name: "Sofia Costa", email: "readonly@him.local", role: "readonly", department: "SUP", jobTitle: "Audit Liaison", badge: "RO-501" },
  ];

  const userRows = await db
    .insert(users)
    .values(
      userSpecs.map((spec) => ({
        username: spec.username,
        name: spec.name,
        email: spec.email,
        passwordHash,
        passwordAlgo: "scrypt",
        passwordUpdatedAt: new Date(),
        status: "ACTIVE" as const,
        jobTitle: spec.jobTitle,
        badgeNumber: spec.badge,
        departmentId: departmentIdByCode.get(spec.department) ?? null,
        lastLoginAt: daysAgo(randomInt(0, 3), randomInt(0, 12)),
      })),
    )
    .returning();

  const userIdByUsername = new Map(userRows.map((row) => [row.username, row.id] as const));
  for (const spec of userSpecs) {
    const userId = userIdByUsername.get(spec.username);
    const roleId = roleIdByKey.get(spec.role);
    if (userId && roleId) await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
  }

  // Give one user a second role to demonstrate multi-role support.
  const operatorId = userIdByUsername.get("operator1");
  const supervisorRoleId = roleIdByKey.get("supervisor");
  if (operatorId && supervisorRoleId) {
    await db.insert(userRoles).values({ userId: operatorId, roleId: supervisorRoleId }).onConflictDoNothing();
  }

  const vehicleIds: string[] = [];
  console.log("Seeding vehicles and people...");
  const vehicleRows = await db
    .insert(vehicles)
    .values(
      Array.from({ length: 15 }, (_, index) => {
        const make = VEHICLE_MAKES[index % VEHICLE_MAKES.length]!;
        return {
          reference: reference("VEH", index + 1),
          registration: `NG${String(randomInt(10, 99))} ${String.fromCharCode(65 + randomInt(0, 25))}${String.fromCharCode(65 + randomInt(0, 25))}${String.fromCharCode(65 + randomInt(0, 25))}`,
          make,
          model: VEHICLE_MODELS[index % VEHICLE_MODELS.length]!,
          year: randomInt(2008, 2024),
          colour: pick(COLOURS),
          bodyType: pick(["Estate", "Hatchback", "Saloon", "Van", "Motorcycle"]),
          fuelType: pick(["Petrol", "Diesel", "Hybrid", "Electric"]),
          vin: maybe(`WVW${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`, 0.7),
          status: pick(["ACTIVE", "ACTIVE", "ACTIVE", "FLAGGED", "STORED"]),
          departmentId: departmentIdByCode.get("OPS") ?? null,
          createdAt: daysAgo(randomInt(10, 700)),
          createdById: userIdByUsername.get("operator1") ?? null,
        };
      }),
    )
    .returning();
  vehicleRows.forEach((row) => vehicleIds.push(row.id));

  const personRows = await db
    .insert(persons)
    .values(
      Array.from({ length: 20 }, (_, index) => ({
        reference: reference("PPL", index + 1),
        firstName: FIRST_NAMES[index % FIRST_NAMES.length]!,
        lastName: LAST_NAMES[index % LAST_NAMES.length]!,
        alias: maybe(pick(["AJ", "Raz", "Nix", "Bo", "Tay"]), 0.25),
        dateOfBirth: new Date(Date.UTC(randomInt(1960, 2006), randomInt(0, 11), randomInt(1, 28))),
        gender: pick(["Female", "Male", "Other", "Prefer not to say"]),
        nationality: pick(["Fictionalian", "Northgate", "Ashcombian", "Other"]),
        occupation: pick(["Engineer", "Teacher", "Driver", "Retail assistant", "Chef", "Student", "Nurse", "Contractor"]),
        status: pick(["ACTIVE", "ACTIVE", "ACTIVE", "MONITORED"]),
        riskLevel: pick([null, "LOW", "LOW", "MEDIUM", "HIGH"]),
        departmentId: departmentIdByCode.get(pick(["OPS", "INV", "SUP"])) ?? null,
        createdAt: daysAgo(randomInt(10, 900)),
        createdById: userIdByUsername.get("operator1") ?? null,
      })),
    )
    .returning();
  const personIds = personRows.map((row) => row.id);

  for (const person of personRows) {
    await db.insert(personIdentifiers).values({
      personId: person.id,
      type: "NATIONAL_ID",
      value: `ID-${person.reference.slice(-5)}-${randomInt(1000, 9999)}`,
      issuingAuthority: "Records Office",
    });
    await db.insert(personContacts).values([
      { personId: person.id, type: "EMAIL", value: `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@example.test`, isPrimary: true },
      { personId: person.id, type: "PHONE", value: `+1 555 ${String(randomInt(1000, 9999))}`, isPrimary: false },
    ]);
    await db.insert(personAddresses).values({
      personId: person.id,
      type: pick(["HOME", "WORK"]),
      line1: `${randomInt(1, 180)} ${pick(STREETS)}`,
      city: pick(CITIES),
      region: "Northgate Region",
      postalCode: `NG${randomInt(1, 40)} ${randomInt(1, 9)}PQ`,
      country: "Fictionalia",
      isPrimary: true,
    });
  }

  // Vehicle ownership: each vehicle gets 1-2 linked people.
  for (const [index, vehicleId] of vehicleIds.entries()) {
    const owner = personIds[index % personIds.length]!;
    await db
      .insert(personVehicles)
      .values({ personId: owner, vehicleId, relationship: pick(["OWNER", "OWNER", "KEEPER"]), isPrimary: true })
      .onConflictDoNothing();
    if (random() < 0.3) {
      await db
        .insert(personVehicles)
        .values({ personId: pick(personIds), vehicleId, relationship: "SECONDARY_USER", isPrimary: false })
        .onConflictDoNothing();
    }
  }

  console.log("Seeding units...");
  const unitRows = await db
    .insert(units)
    .values(
      Array.from({ length: 10 }, (_, index) => ({
        name: `Unit ${index + 1}`,
        callsign: `${["A", "B", "C"][index % 3]!}${index + 10}`,
        departmentId: departmentIdByCode.get(index % 3 === 0 ? "SUP" : "OPS") ?? null,
        status: pick(["AVAILABLE", "AVAILABLE", "EN_ROUTE", "ON_SCENE", "BUSY", "OFF_DUTY"]),
        statusUpdatedAt: daysAgo(0, randomInt(0, 6)),
        location: pick(["Depot", "Northgate", "Harbour Road", "Ridgeway", "On patrol"]),
        vehicleId: index < 8 ? vehicleIds[index % vehicleIds.length]! : null,
        active: true,
      })),
    )
    .returning();

  const operationalUserIds = ["officer1", "officer2", "operator1", "operator2", "analyst1"]
    .map((username) => userIdByUsername.get(username))
    .filter((id): id is string => Boolean(id));

  for (const unit of unitRows) {
    const memberCount = randomInt(1, 3);
    for (let i = 0; i < memberCount; i += 1) {
      const userId = pick(operationalUserIds);
      await db.insert(unitMembers).values({ unitId: unit.id, userId, role: i === 0 ? "LEAD" : "MEMBER" }).onConflictDoNothing();
    }
  }

  console.log("Seeding configuration (modules, navigation, statuses, terminology)...");
  await db
    .insert(modulesTable)
    .values(
      MODULE_DEFINITIONS.map((module, index) => ({
        key: module.key,
        name: module.name,
        description: module.description,
        icon: module.icon,
        enabled: true,
        isCore: module.core ?? false,
        sortOrder: index,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(navigationItems)
    .values(
      DEFAULT_NAVIGATION.map((item) => ({
        key: item.key,
        label: item.label,
        href: item.href,
        icon: item.icon,
        moduleKey: item.moduleKey ?? null,
        permission: item.permission ?? null,
        group: item.group,
        sortOrder: item.sortOrder,
        enabled: true,
        isSystem: item.isSystem ?? false,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(statusDefinitions)
    .values(
      Object.entries(DEFAULT_STATUSES).flatMap(([resourceType, statuses]) =>
        statuses.map((status, index) => ({
          resourceType,
          key: status.key,
          label: status.label,
          colour: status.colour,
          isDefault: status.isDefault ?? index === 0,
          isClosed: status.isClosed ?? false,
          sortOrder: index,
        })),
      ),
    )
    .onConflictDoNothing();

  await db
    .insert(categoryDefinitions)
    .values(
      Object.entries(DEFAULT_CATEGORIES).flatMap(([resourceType, categories]) =>
        categories.map((category, index) => ({
          resourceType,
          key: category.key,
          label: category.label,
          colour: category.colour,
          icon: category.icon ?? null,
          sortOrder: index,
        })),
      ),
    )
    .onConflictDoNothing();

  await db.insert(terminologyEntries).values(DEFAULT_TERMINOLOGY).onConflictDoNothing();

  await db
    .insert(organisationSettings)
    .values({
      key: "default",
      organisationName: "Northgate Operations",
      organisationShort: "NGO",
      tagline: "Operational information platform",
      contactEmail: "control@northgate.example",
      contactPhone: "+1 555 0100",
      address: "1 Control Centre, Northgate",
      primaryColour: "#3b82f6",
      accentColour: "#22d3ee",
      sidebarColour: "#0b1220",
    })
    .onConflictDoNothing();

  await db.insert(themeSettings).values({ key: "default", mode: "dark", accentColour: "#3b82f6", density: "comfortable", radius: "0.6rem", sidebarStyle: "default", fontFamily: "inter", motion: "full" }).onConflictDoNothing();

  await db
    .insert(systemSettings)
    .values([
      { key: "session.ttlHours", value: 12, description: "Session lifetime in hours." },
      { key: "records.pageSize", value: 25, description: "Default list page size." },
      { key: "dispatch.autoAssign", value: false, description: "Automatically suggest units for new calls." },
      { key: "notifications.retentionDays", value: 90, description: "Notification retention window." },
      { key: "search.minLength", value: 2, description: "Minimum global search term length." },
    ])
    .onConflictDoNothing();

  console.log("Seeding custom fields, form and workflow...");
  const fieldRows = await db
    .insert(customFieldDefinitions)
    .values([
      {
        resourceType: "person",
        key: "preferred_language",
        label: "Preferred language",
        type: "SELECT",
        section: "Additional details",
        helpText: "Language the person prefers to be contacted in.",
        options: [
          { label: "English", value: "EN" },
          { label: "Fictionalian", value: "FI" },
          { label: "Other", value: "OTHER" },
        ],
        sortOrder: 1,
        createdById: userIdByUsername.get("admin") ?? null,
      },
      {
        resourceType: "person",
        key: "interpreter_required",
        label: "Interpreter required",
        type: "CHECKBOX",
        section: "Additional details",
        sortOrder: 2,
        createdById: userIdByUsername.get("admin") ?? null,
      },
      {
        resourceType: "incident",
        key: "supervisor_approval",
        label: "Supervisor approval reference",
        type: "TEXT",
        section: "Governance",
        helpText: "Required for high-priority incidents.",
        conditions: [{ field: "priority", operator: "EQUALS", value: "HIGH" }],
        sortOrder: 1,
        createdById: userIdByUsername.get("admin") ?? null,
      },
      {
        resourceType: "vehicle",
        key: "fleet_number",
        label: "Fleet number",
        type: "TEXT",
        section: "Fleet",
        showInList: true,
        sortOrder: 1,
        createdById: userIdByUsername.get("admin") ?? null,
      },
    ])
    .returning();

  for (const field of fieldRows) {
    if (field.key === "fleet_number") {
      for (const vehicleId of vehicleIds.slice(0, 8)) {
        await db.insert(customFieldValues).values({ definitionId: field.id, recordId: vehicleId, value: `FL-${randomInt(100, 999)}` }).onConflictDoNothing();
      }
    }
    if (field.key === "preferred_language") {
      for (const personId of personIds.slice(0, 10)) {
        await db.insert(customFieldValues).values({ definitionId: field.id, recordId: personId, value: pick(["EN", "FI", "OTHER"]) }).onConflictDoNothing();
      }
    }
  }

  const [form] = await db
    .insert(forms)
    .values({
      key: "incident_supplementary",
      name: "Incident supplementary record",
      description: "Completed when additional detail is gathered after an incident is created.",
      resourceType: "incident",
      status: "PUBLISHED",
      createdById: userIdByUsername.get("admin") ?? null,
    })
    .returning();

  if (form) {
    await db.insert(formFields).values([
      { formId: form.id, key: "summary", label: "Summary of additional information", type: "TEXTAREA", required: true, sortOrder: 1 },
      { formId: form.id, key: "witnesses", label: "Number of witnesses", type: "NUMBER", sortOrder: 2, width: "half" },
      { formId: form.id, key: "priority_review", label: "Priority review required", type: "CHECKBOX", sortOrder: 3, width: "half" },
      { formId: form.id, key: "supervisor", label: "Supervisor", type: "USER", helpText: "Who reviewed the additional information.", conditions: [{ field: "priority_review", operator: "EQUALS", value: "true" }], sortOrder: 4 },
    ]);
  }

  const [workflow] = await db
    .insert(workflows)
    .values({
      key: "high_priority_incident",
      name: "High priority incident escalation",
      description: "Notifies supervisors and opens a review task when a high priority incident is created.",
      resourceType: "incident",
      trigger: "RECORD_CREATED",
      enabled: true,
      createdById: userIdByUsername.get("admin") ?? null,
    })
    .returning();

  if (workflow) {
    await db.insert(workflowConditions).values([
      { workflowId: workflow.id, field: "priority", operator: "EQUALS", value: "HIGH", conjunction: "AND", sortOrder: 1 },
    ]);
    await db.insert(workflowActions).values([
      { workflowId: workflow.id, type: "SEND_NOTIFICATION", config: { permission: "reports.approve", title: "High priority incident created", message: "A high priority incident requires supervisor awareness." }, sortOrder: 1 },
      { workflowId: workflow.id, type: "CREATE_TASK", config: { title: "Review high priority incident", description: "Confirm resourcing and review the initial report.", priority: "HIGH", dueInDays: 1 }, sortOrder: 2 },
      { workflowId: workflow.id, type: "CREATE_TIMELINE_EVENT", config: { message: "Escalation workflow executed", eventType: "WORKFLOW" }, sortOrder: 3 },
    ]);
  }

  const [reportWorkflow] = await db
    .insert(workflows)
    .values({
      key: "report_submitted",
      name: "Report submitted notification",
      description: "Creates a review task and notifies approvers when a report is submitted.",
      resourceType: "report",
      trigger: "REPORT_SUBMITTED",
      enabled: true,
      createdById: userIdByUsername.get("admin") ?? null,
    })
    .returning();

  if (reportWorkflow) {
    await db.insert(workflowActions).values([
      { workflowId: reportWorkflow.id, type: "SEND_NOTIFICATION", config: { permission: "reports.approve", title: "Report awaiting review", message: "A report has been submitted and is awaiting review." }, sortOrder: 1 },
      { workflowId: reportWorkflow.id, type: "CREATE_TASK", config: { title: "Complete report review", description: "Review the submitted report and approve or reject it.", priority: "MEDIUM", dueInDays: 2 }, sortOrder: 2 },
    ]);
  }

  console.log("Seeding incidents, cases, reports, tasks and notices...");
  const closedStatuses = ["CLOSED"];
  const incidentRows = await db
    .insert(incidents)
    .values(
      Array.from({ length: 20 }, (_, index) => {
        const priority = pick(["LOW", "MEDIUM", "MEDIUM", "HIGH", "CRITICAL"]);
        const status = pick(["NEW", "ASSIGNED", "IN_PROGRESS", "IN_PROGRESS", "PENDING", "CLOSED", "CLOSED"]);
        const reported = daysAgo(randomInt(0, 60), randomInt(0, 23));
        return {
          reference: reference("INC", index + 1),
          title: INCIDENT_TITLES[index % INCIDENT_TITLES.length]!,
          description: `Initial details recorded by control room. Further enquiries are ongoing and all information is fictional sample data for demonstration purposes.`,
          status,
          priority,
          categoryId: null,
          departmentId: departmentIdByCode.get(pick(["OPS", "INV", "SUP"])) ?? null,
          location: `${randomInt(1, 180)} ${pick(STREETS)}, ${pick(CITIES)}`,
          reportedAt: reported,
          occurredAt: new Date(reported.getTime() - randomInt(1, 12) * 60 * 60 * 1000),
          closedAt: closedStatuses.includes(status) ? new Date(reported.getTime() + randomInt(2, 48) * 60 * 60 * 1000) : null,
          supervisorId: pick([supervisorRoleId ? userIdByUsername.get("supervisor1") : null, userIdByUsername.get("supervisor2") ?? null].filter(Boolean) as string[]) ?? null,
          createdAt: reported,
          createdById: userIdByUsername.get(pick(["operator1", "operator2"])) ?? null,
          updatedById: userIdByUsername.get("operator1") ?? null,
        };
      }),
    )
    .returning();

  for (const [index, incident] of incidentRows.entries()) {
    const participantCount = randomInt(1, 3);
    for (let i = 0; i < participantCount; i += 1) {
      await db
        .insert(incidentParticipants)
        .values({
          incidentId: incident.id,
          personId: pick(personIds),
          role: pick(["INVOLVED", "WITNESS", "REPORTING"]),
          notes: maybe("Provided a short statement at the scene.", 0.4),
        })
        .onConflictDoNothing();
    }
    if (random() < 0.7) {
      await db
        .insert(incidentVehicles)
        .values({ incidentId: incident.id, vehicleId: pick(vehicleIds), role: pick(["INVOLVED", "SUSPECT", "WITNESS"]) })
        .onConflictDoNothing();
    }
    if (random() < 0.6) {
      const unit = pick(unitRows);
      await db.insert(incidentAssignments).values({
        incidentId: incident.id,
        unitId: unit.id,
        role: "ASSIGNED",
        assignedAt: incident.reportedAt,
        clearedAt: incident.status === "CLOSED" ? incident.closedAt : null,
      });
    }

    await db.insert(timelineEntries).values({
      recordType: "incident",
      recordId: incident.id,
      type: "CREATED",
      message: "Incident created in control room",
      actorId: incident.createdById,
      actorName: "Control Room Operator",
      occurredAt: incident.reportedAt,
    });
    await db.insert(timelineEntries).values({
      recordType: "incident",
      recordId: incident.id,
      type: "STATUS",
      message: `Status changed to ${incident.status}`,
      actorName: "System",
      occurredAt: new Date(incident.reportedAt.getTime() + 60 * 60 * 1000),
    });
    if (index % 3 === 0) {
      await db.insert(notes).values({
        recordType: "incident",
        recordId: incident.id,
        body: pick([
          "Caller requested a callback after 18:00.",
          "CCTV coverage is available from the neighbouring premises.",
          "Second unit requested for scene guard.",
          "Follow-up scheduled with the investigations team.",
        ]),
        authorId: userIdByUsername.get("operator1") ?? null,
      });
    }
  }

  // Reports with version history
  for (let index = 0; index < 15; index += 1) {
    const incident = incidentRows[index % incidentRows.length]!;
    const status = pick(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "APPROVED", "FINAL", "REJECTED"]);
    const author = userIdByUsername.get(pick(["operator1", "operator2", "officer1", "analyst1"]))!;
    const [report] = await db
      .insert(reports)
      .values({
        reference: reference("RPT", index + 1),
        title: `${pick(REPORT_TITLES)} - ${incident.reference}`,
        body: [
          "Summary",
          "-------",
          `This report documents activity relating to ${incident.title}. All content is fictional sample data.`,
          "",
          "Detail",
          "------",
          "Attending personnel recorded the following sequence of events and observations. No real persons or organisations are referenced.",
          "",
          "Conclusion",
          "----------",
          "No further action is required at this time; the record is retained for auditing and reporting purposes.",
        ].join("\n"),
        status,
        currentVersion: status === "DRAFT" ? 1 : 2,
        incidentId: incident.id,
        authorId: author,
        reviewerId: ["APPROVED", "REJECTED", "FINAL"].includes(status) ? (userIdByUsername.get("supervisor1") ?? null) : null,
        submittedAt: ["DRAFT"].includes(status) ? null : daysAgo(randomInt(0, 20)),
        reviewedAt: ["APPROVED", "REJECTED", "FINAL"].includes(status) ? daysAgo(randomInt(0, 10)) : null,
        createdAt: daysAgo(randomInt(0, 40)),
      })
      .returning();

    if (!report) continue;
    await db.insert(reportVersions).values({
      reportId: report.id,
      version: 1,
      title: report.title,
      body: report.body,
      changeNote: "Initial draft",
      createdById: author,
      createdAt: report.createdAt,
    });
    if (report.currentVersion > 1) {
      await db.insert(reportVersions).values({
        reportId: report.id,
        version: 2,
        title: report.title,
        body: `${report.body}\n\n[Updated] Additional detail added following review.`,
        changeNote: "Updated after supervisor feedback",
        createdById: author,
        createdAt: new Date(report.createdAt.getTime() + 3600_000),
      });
    }
  }

  // Cases
  const caseRows = await db
    .insert(cases)
    .values(
      Array.from({ length: 6 }, (_, index) => ({
        reference: reference("CAS", index + 1),
        title: `${pick(["Theft series", "Recovered property", "Welfare enquiry", "Fraud pattern", "Vehicle crime", "Missing person"])} - ${pick(CITIES)}`,
        description: "Fictional case record used to demonstrate case management and review workflow.",
        status: pick(["OPEN", "INVESTIGATING", "REVIEW", "RESOLVED"]),
        priority: pick(["LOW", "MEDIUM", "HIGH"]),
        departmentId: departmentIdByCode.get("INV") ?? null,
        leadId: userIdByUsername.get(pick(["supervisor2", "analyst1"])) ?? null,
        openedAt: daysAgo(randomInt(5, 120)),
      })),
    )
    .returning();

  // Tasks
  const taskRows = await db
    .insert(tasks)
    .values(
      Array.from({ length: 10 }, (_, index) => {
        const due = new Date(Date.now() + (index % 3 === 0 ? -1 : 1) * randomInt(1, 5) * 24 * 60 * 60 * 1000);
        return {
          reference: reference("TSK", index + 1),
          title: pick([
            "Follow up with witness",
            "Review CCTV coverage",
            "Complete property inventory",
            "Prepare case summary",
            "Confirm unit availability",
            "Update incident narrative",
            "Schedule interview",
            "Verify vehicle ownership",
            "Close out report",
            "Escalate to supervisor",
          ]),
          description: "Fictional task used to demonstrate assignment, comments and status workflow.",
          status: pick(["OPEN", "OPEN", "IN_PROGRESS", "COMPLETED", "BLOCKED"]),
          priority: pick(["LOW", "MEDIUM", "HIGH"]),
          assigneeId: pick(operationalUserIds),
          creatorId: userIdByUsername.get("supervisor1") ?? null,
          dueAt: due,
          completedAt: null,
          recordType: index % 2 === 0 ? "incident" : null,
          recordId: index % 2 === 0 ? pick(incidentRows).id : null,
          createdAt: daysAgo(randomInt(0, 20)),
        };
      }),
    )
    .returning();

  for (const task of taskRows.slice(0, 5)) {
    await db.insert(taskComments).values({
      taskId: task.id,
      authorId: task.assigneeId,
      body: pick([
        "Picked this up this morning, will update before end of shift.",
        "Need the reference number before I can progress this.",
        "Completed the first pass; awaiting confirmation.",
      ]),
    });
  }

  // Warrants, alerts, BOLOs, evidence
  for (let index = 0; index < 8; index += 1) {
    await db.insert(warrants).values({
      reference: reference("WAR", index + 1),
      personId: pick(personIds),
      type: pick(["ARREST", "SEARCH", "COMMITTAL"]),
      status: pick(["ACTIVE", "ACTIVE", "PENDING", "EXECUTED", "EXPIRED"]),
      description: "Fictional warrant record for demonstration only.",
      issuingAuthority: "Fictional Review Authority",
      issuedAt: daysAgo(randomInt(1, 200)),
      expiresAt: random() < 0.5 ? new Date(Date.now() + randomInt(5, 200) * 24 * 60 * 60 * 1000) : null,
    });
  }

  const alertRows = await db
    .insert(alerts)
    .values(
      Array.from({ length: 10 }, (_, index) => ({
        reference: reference("ALR", index + 1),
        type: pick(["SAFETY", "OPERATIONAL", "INFORMATION"]),
        subject: ALERT_SUBJECTS[index % ALERT_SUBJECTS.length]!,
        description: "Fictional alert used to demonstrate acknowledgement and expiry handling.",
        priority: pick(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        status: pick(["ACTIVE", "ACTIVE", "ACKNOWLEDGED", "RESOLVED"]),
        expiresAt: random() < 0.6 ? new Date(Date.now() + randomInt(1, 30) * 24 * 60 * 60 * 1000) : null,
        createdAt: daysAgo(randomInt(0, 30)),
        createdById: userIdByUsername.get("supervisor1") ?? null,
      })),
    )
    .returning();

  const boloRows = await db
    .insert(bolos)
    .values(
      Array.from({ length: 6 }, (_, index) => ({
        reference: reference("BLO", index + 1),
        subject: BOLO_SUBJECTS[index % BOLO_SUBJECTS.length]!,
        description: "Fictional be-on-the-lookout notice for demonstration purposes.",
        status: pick(["ACTIVE", "ACTIVE", "LOCATED", "CANCELLED"]),
        priority: pick(["MEDIUM", "HIGH"]),
        personId: random() < 0.6 ? pick(personIds) : null,
        vehicleId: random() < 0.6 ? pick(vehicleIds) : null,
        expiresAt: new Date(Date.now() + randomInt(1, 21) * 24 * 60 * 60 * 1000),
        createdAt: daysAgo(randomInt(0, 25)),
        createdById: userIdByUsername.get("operator1") ?? null,
      })),
    )
    .returning();

  const evidenceRows = await db
    .insert(evidence)
    .values(
      Array.from({ length: 12 }, (_, index) => ({
        itemNumber: reference("EVD", index + 1),
        description: pick([
          "Mobile handset recovered at scene",
          "Printed CCTV stills",
          "Vehicle registration document",
          "Witness statement (signed)",
          "Photographic record of damage",
          "USB storage device",
          "Key set",
          "Clothing item (bagged)",
        ]),
        categoryId: pick(["DOCUMENT", "ELECTRONIC", "PHYSICAL", "SAMPLE"]),
        quantity: randomInt(1, 3),
        location: pick(["Main store, shelf A", "Main store, shelf B", "Temporary store", "Laboratory"]),
        status: pick(["IN_CUSTODY", "IN_CUSTODY", "AT_LAB", "RELEASED"]),
        incidentId: pick(incidentRows).id,
        custodianId: userIdByUsername.get(pick(["operator1", "analyst1"])) ?? null,
        collectedAt: daysAgo(randomInt(0, 40)),
        collectedFrom: pick(["Scene", "Person", "Vehicle", "Premises"]),
        createdAt: daysAgo(randomInt(0, 40)),
      })),
    )
    .returning();

  for (const item of evidenceRows) {
    await db.insert(evidenceEvents).values({
      evidenceId: item.id,
      type: "COLLECTED",
      toLocation: item.location,
      toCustodianId: item.custodianId,
      actorId: item.custodianId,
      notes: "Item booked into custody",
      occurredAt: item.collectedAt ?? new Date(),
    });
    if (random() < 0.5) {
      await db.insert(evidenceEvents).values({
        evidenceId: item.id,
        type: "TRANSFER",
        fromLocation: item.location,
        toLocation: "Laboratory",
        fromCustodianId: item.custodianId,
        toCustodianId: userIdByUsername.get("analyst1") ?? null,
        actorId: item.custodianId,
        notes: "Transferred for examination",
        occurredAt: new Date((item.collectedAt?.getTime() ?? Date.now()) + 86400_000),
      });
    }
  }

  console.log("Seeding dispatch calls, communications, notifications and audit...");
  const callRows = await db
    .insert(calls)
    .values(
      Array.from({ length: 12 }, (_, index) => {
        const received = daysAgo(0, randomInt(0, 20));
        const status = pick(["PENDING", "DISPATCHED", "ON_SCENE", "CLOSED"]);
        return {
          reference: reference("CAL", index + 1),
          type: pick(["GENERAL", "TRAFFIC", "WELFARE", "PRIORITY"]),
          priority: pick(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
          status,
          description: `${pick(INCIDENT_TITLES)} - caller reports ongoing situation requiring response.`,
          location: `${randomInt(1, 180)} ${pick(STREETS)}, ${pick(CITIES)}`,
          callerName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
          callerPhone: `+1 555 ${String(randomInt(1000, 9999))}`,
          receivedAt: received,
          dispatchedAt: status === "PENDING" ? null : new Date(received.getTime() + 5 * 60_000),
          closedAt: status === "CLOSED" ? new Date(received.getTime() + randomInt(1, 4) * 3600_000) : null,
          incidentId: index < 6 ? incidentRows[index]?.id ?? null : null,
          departmentId: departmentIdByCode.get("OPS") ?? null,
          receivedById: userIdByUsername.get(pick(["operator1", "operator2"])) ?? null,
        };
      }),
    )
    .returning();

  for (const call of callRows) {
    if (["PENDING"].includes(call.status)) continue;
    const unit = pick(unitRows);
    await db
      .insert(callUnits)
      .values({
        callId: call.id,
        unitId: unit.id,
        status: pick(["ASSIGNED", "ON_SCENE", "CLEARED"]),
        assignedAt: call.dispatchedAt ?? call.receivedAt,
        arrivedAt: call.status === "ON_SCENE" ? new Date(call.receivedAt.getTime() + 12 * 60_000) : null,
        clearedAt: call.status === "CLOSED" ? call.closedAt : null,
      })
      .onConflictDoNothing();
  }

  // Communications: a general channel, a department channel and a direct message
  const [generalChannel] = await db
    .insert(channels)
    .values({ name: "Control room", type: "GROUP", topic: "Day-to-day control room coordination", createdById: userIdByUsername.get("supervisor1") ?? null })
    .returning();
  const [opsChannel] = await db
    .insert(channels)
    .values({ name: "Operations", type: "DEPARTMENT", departmentId: departmentIdByCode.get("OPS") ?? null, topic: "Operations department channel", createdById: userIdByUsername.get("supervisor1") ?? null })
    .returning();
  const [directChannel] = await db
    .insert(channels)
    .values({ name: "Dana Whitfield & Marcus Bell", type: "DIRECT", createdById: userIdByUsername.get("admin") ?? null })
    .returning();

  if (generalChannel) {
    const memberIds = userRows.map((row) => row.id);
    await db.insert(channelMembers).values(memberIds.map((userId) => ({ channelId: generalChannel.id, userId, lastReadAt: daysAgo(randomInt(0, 2)) }))).onConflictDoNothing();
    const samples = [
      "Morning all - briefing notes are on the dashboard.",
      "Unit A12 is available again after refuelling.",
      "Please remember to attach the supplementary form for high priority incidents.",
      "Handover complete. No outstanding critical items.",
    ];
    for (const [index, body] of samples.entries()) {
      await db.insert(messages).values({
        channelId: generalChannel.id,
        authorId: pick(userRows).id,
        body,
        createdAt: new Date(Date.now() - (samples.length - index) * 45 * 60_000),
      });
    }
  }
  if (opsChannel) {
    const opsMembers = userRows.filter((row) => row.departmentId === departmentIdByCode.get("OPS")).map((row) => row.id);
    await db.insert(channelMembers).values(opsMembers.map((userId) => ({ channelId: opsChannel.id, userId }))).onConflictDoNothing();
    await db.insert(messages).values({ channelId: opsChannel.id, authorId: userIdByUsername.get("supervisor1")!, body: "Shift pattern updated for next week - please check the rota." });
  }
  if (directChannel && userIdByUsername.get("admin") && userIdByUsername.get("supervisor1")) {
    await db.insert(channelMembers).values([
      { channelId: directChannel.id, userId: userIdByUsername.get("admin")! },
      { channelId: directChannel.id, userId: userIdByUsername.get("supervisor1")! },
    ]).onConflictDoNothing();
    await db.insert(messages).values({ channelId: directChannel.id, authorId: userIdByUsername.get("admin")!, body: "Reminder: the quarterly configuration review is due." });
  }

  // Notifications for the administrator and supervisors
  const notificationTargets = ["admin", "supervisor1", "supervisor2", "operator1"].map((username) => userIdByUsername.get(username)).filter((id): id is string => Boolean(id));
  for (const userId of notificationTargets) {
    for (let index = 0; index < 5; index += 1) {
      await db.insert(notifications).values({
        userId,
        type: pick(["REPORT", "TASK", "ALERT", "WORKFLOW", "SYSTEM"]),
        category: pick(["REPORTS", "TASKS", "ALERTS", "WORKFLOWS", "SYSTEM"]),
        priority: pick(["NORMAL", "NORMAL", "HIGH"]),
        title: pick([
          "Report submitted for review",
          "New task assigned to you",
          "High priority incident created",
          "Workflow completed",
          "Unit status changed",
        ]),
        message: "This is a sample notification generated by the development seed.",
        resourceType: pick(["incident", "report", "task", "alert"]),
        resourceId: pick(incidentRows).id,
        readAt: index < 2 ? new Date() : null,
        createdAt: daysAgo(randomInt(0, 10)),
      });
    }
  }

  // Audit trail
  const auditActions = ["incident.created", "incident.updated", "report.submitted", "report.approved", "person.created", "unit.status.changed", "evidence.created", "user.updated"];
  for (let index = 0; index < 60; index += 1) {
    await db.insert(auditLogs).values({
      actorId: pick(userRows).id,
      actorName: pick(userRows).name,
      action: pick(auditActions),
      resourceType: pick(["incident", "report", "person", "vehicle", "unit", "evidence", "user"]),
      resourceId: pick(incidentRows).id,
      summary: "Sample audit entry created by the development seed.",
      previousValue: { status: "NEW" },
      newValue: { status: "IN_PROGRESS" },
      ip: `10.0.${randomInt(0, 5)}.${randomInt(2, 250)}`,
      userAgent: "seed/1.0",
      createdAt: daysAgo(randomInt(0, 30), randomInt(0, 23)),
    });
  }

  // Generic relationships between records (demonstrates the generic linker)
  for (let index = 0; index < 10; index += 1) {
    await db
      .insert(recordRelationships)
      .values({
        fromType: "incident",
        fromId: pick(incidentRows).id,
        toType: "person",
        toId: pick(personIds),
        relationType: "RELATED",
        createdById: userIdByUsername.get("operator1") ?? null,
      })
      .onConflictDoNothing();
  }

  // Dashboards for each user
  for (const user of userRows) {
    const [dashboard] = await db.insert(dashboards).values({ userId: user.id, name: "My dashboard", isDefault: true }).returning();
    if (!dashboard) continue;
    await db.insert(dashboardWidgets).values(
      DEFAULT_DASHBOARD_WIDGETS.map((widget, index) => ({
        dashboardId: dashboard.id,
        type: widget.type,
        title: widget.title,
        size: widget.size,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        sortOrder: index,
        visible: true,
      })),
    );
  }

  // A couple of saved views to demonstrate the table system
  await db.insert(savedViews).values(
    ["incident", "person"].map((resourceType, index) => ({
      userId: userIdByUsername.get("operator1")!,
      resourceType,
      name: index === 0 ? "My open incidents" : "Monitored people",
      config: { filters: index === 0 ? { status: ["NEW", "IN_PROGRESS"] } : { status: ["MONITORED"] }, sorting: [] },
      sortOrder: index,
    })),
  );

  console.log("Seed complete.");
  console.log(`  ${userRows.length} users (password: ${DEMO_PASSWORD})`);
  console.log(`  ${personRows.length} people, ${vehicleRows.length} vehicles, ${incidentRows.length} incidents`);
  console.log(`  ${caseRows.length} cases, ${alertRows.length} alerts, ${boloRows.length} BOLOs, ${evidenceRows.length} evidence items`);
  console.log(`  ${callRows.length} dispatch calls, ${taskRows.length} tasks, ${unitRows.length} units`);
}

if (process.argv[1]?.includes("seed")) {
  seed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Seed failed:", error);
      await pool.end();
      process.exit(1);
    });
}

export { sql };
