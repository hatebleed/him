import { PERMISSION_KEYS } from "./permissions";

/**
 * Seed defaults. These values are written to the database on first
 * installation ONLY - after that the database is the source of truth and
 * administrators can change everything here through the UI.
 */

export type StatusSeed = {
  key: string;
  label: string;
  colour: string;
  isDefault?: boolean;
  isClosed?: boolean;
  description?: string;
};

export type CategorySeed = {
  key: string;
  label: string;
  colour: string;
  icon?: string;
  description?: string;
};

// ---------------------------------------------------------------------------
// Statuses per resource type
// ---------------------------------------------------------------------------

export const DEFAULT_STATUSES: Record<string, StatusSeed[]> = {
  incident: [
    { key: "NEW", label: "New", colour: "#38bdf8", isDefault: true },
    { key: "ASSIGNED", label: "Assigned", colour: "#818cf8" },
    { key: "IN_PROGRESS", label: "In Progress", colour: "#f59e0b" },
    { key: "PENDING", label: "Pending", colour: "#a3a3a3" },
    { key: "CLOSED", label: "Closed", colour: "#22c55e", isClosed: true },
  ],
  case: [
    { key: "OPEN", label: "Open", colour: "#38bdf8", isDefault: true },
    { key: "INVESTIGATING", label: "Investigating", colour: "#818cf8" },
    { key: "REVIEW", label: "Review", colour: "#f59e0b" },
    { key: "RESOLVED", label: "Resolved", colour: "#22c55e" },
    { key: "ARCHIVED", label: "Archived", colour: "#64748b", isClosed: true },
  ],
  report: [
    { key: "DRAFT", label: "Draft", colour: "#94a3b8", isDefault: true },
    { key: "SUBMITTED", label: "Submitted", colour: "#38bdf8" },
    { key: "UNDER_REVIEW", label: "Under Review", colour: "#f59e0b" },
    { key: "APPROVED", label: "Approved", colour: "#22c55e" },
    { key: "REJECTED", label: "Rejected", colour: "#ef4444" },
    { key: "FINAL", label: "Final", colour: "#14b8a6" },
    { key: "ARCHIVED", label: "Archived", colour: "#64748b", isClosed: true },
  ],
  task: [
    { key: "OPEN", label: "Open", colour: "#38bdf8", isDefault: true },
    { key: "IN_PROGRESS", label: "In Progress", colour: "#f59e0b" },
    { key: "BLOCKED", label: "Blocked", colour: "#ef4444" },
    { key: "COMPLETED", label: "Completed", colour: "#22c55e", isClosed: true },
    { key: "CANCELLED", label: "Cancelled", colour: "#64748b", isClosed: true },
  ],
  person: [
    { key: "ACTIVE", label: "Active", colour: "#22c55e", isDefault: true },
    { key: "MONITORED", label: "Monitored", colour: "#f59e0b" },
    { key: "ARCHIVED", label: "Archived", colour: "#64748b", isClosed: true },
  ],
  vehicle: [
    { key: "ACTIVE", label: "Active", colour: "#22c55e", isDefault: true },
    { key: "STORED", label: "Stored", colour: "#94a3b8" },
    { key: "RECOVERED", label: "Recovered", colour: "#38bdf8" },
    { key: "FLAGGED", label: "Flagged", colour: "#ef4444" },
    { key: "ARCHIVED", label: "Archived", colour: "#64748b", isClosed: true },
  ],
  warrant: [
    { key: "ACTIVE", label: "Active", colour: "#ef4444", isDefault: true },
    { key: "PENDING", label: "Pending", colour: "#f59e0b" },
    { key: "EXECUTED", label: "Executed", colour: "#22c55e" },
    { key: "EXPIRED", label: "Expired", colour: "#64748b" },
    { key: "CANCELLED", label: "Cancelled", colour: "#64748b", isClosed: true },
  ],
  alert: [
    { key: "ACTIVE", label: "Active", colour: "#ef4444", isDefault: true },
    { key: "ACKNOWLEDGED", label: "Acknowledged", colour: "#f59e0b" },
    { key: "RESOLVED", label: "Resolved", colour: "#22c55e" },
    { key: "EXPIRED", label: "Expired", colour: "#64748b", isClosed: true },
  ],
  bolo: [
    { key: "ACTIVE", label: "Active", colour: "#ef4444", isDefault: true },
    { key: "LOCATED", label: "Located", colour: "#22c55e" },
    { key: "CANCELLED", label: "Cancelled", colour: "#64748b", isClosed: true },
    { key: "EXPIRED", label: "Expired", colour: "#64748b", isClosed: true },
  ],
  evidence: [
    { key: "IN_CUSTODY", label: "In Custody", colour: "#38bdf8", isDefault: true },
    { key: "AT_LAB", label: "At Laboratory", colour: "#818cf8" },
    { key: "RELEASED", label: "Released", colour: "#22c55e", isClosed: true },
    { key: "DESTROYED", label: "Destroyed", colour: "#64748b", isClosed: true },
  ],
  unit: [
    { key: "AVAILABLE", label: "Available", colour: "#22c55e", isDefault: true },
    { key: "EN_ROUTE", label: "En Route", colour: "#38bdf8" },
    { key: "ON_SCENE", label: "On Scene", colour: "#f59e0b" },
    { key: "BUSY", label: "Busy", colour: "#a855f7" },
    { key: "OUT_OF_SERVICE", label: "Out of Service", colour: "#64748b" },
    { key: "OFF_DUTY", label: "Off Duty", colour: "#475569" },
  ],
  call: [
    { key: "PENDING", label: "Pending", colour: "#f59e0b", isDefault: true },
    { key: "DISPATCHED", label: "Dispatched", colour: "#38bdf8" },
    { key: "ON_SCENE", label: "On Scene", colour: "#818cf8" },
    { key: "CLOSED", label: "Closed", colour: "#22c55e", isClosed: true },
    { key: "CANCELLED", label: "Cancelled", colour: "#64748b", isClosed: true },
  ],
};

// ---------------------------------------------------------------------------
// Categories per resource type
// ---------------------------------------------------------------------------

export const DEFAULT_CATEGORIES: Record<string, CategorySeed[]> = {
  incident: [
    { key: "TRAFFIC", label: "Traffic", colour: "#38bdf8", icon: "Car" },
    { key: "THEFT", label: "Theft", colour: "#f59e0b", icon: "PackageSearch" },
    { key: "ASSAULT", label: "Assault", colour: "#ef4444", icon: "AlertTriangle" },
    { key: "BURGLARY", label: "Burglary", colour: "#a855f7", icon: "DoorOpen" },
    { key: "FRAUD", label: "Fraud", colour: "#14b8a6", icon: "CreditCard" },
    { key: "WELFARE", label: "Welfare Check", colour: "#22c55e", icon: "HeartHandshake" },
    { key: "OTHER", label: "Other", colour: "#64748b", icon: "CircleDot" },
  ],
  case: [
    { key: "INVESTIGATION", label: "Investigation", colour: "#38bdf8", icon: "Search" },
    { key: "REVIEW", label: "Review", colour: "#f59e0b", icon: "Eye" },
    { key: "COMPLIANCE", label: "Compliance", colour: "#22c55e", icon: "ShieldCheck" },
  ],
  report: [
    { key: "INCIDENT", label: "Incident Report", colour: "#38bdf8", icon: "FileText" },
    { key: "SUPPLEMENT", label: "Supplementary", colour: "#818cf8", icon: "FilePlus" },
    { key: "WITNESS", label: "Witness Statement", colour: "#14b8a6", icon: "MessageSquare" },
    { key: "DAILY", label: "Daily Summary", colour: "#64748b", icon: "Calendar" },
  ],
  person: [
    { key: "WITNESS", label: "Witness", colour: "#38bdf8", icon: "Eye" },
    { key: "REPORTING", label: "Reporting Party", colour: "#22c55e", icon: "Megaphone" },
    { key: "INVOLVED", label: "Involved Party", colour: "#f59e0b", icon: "UserCheck" },
    { key: "OTHER", label: "Other", colour: "#64748b", icon: "User" },
  ],
  vehicle: [
    { key: "CAR", label: "Car", colour: "#38bdf8", icon: "Car" },
    { key: "VAN", label: "Van", colour: "#f59e0b", icon: "Truck" },
    { key: "MOTORCYCLE", label: "Motorcycle", colour: "#a855f7", icon: "Bike" },
    { key: "COMMERCIAL", label: "Commercial", colour: "#14b8a6", icon: "Bus" },
  ],
  evidence: [
    { key: "DOCUMENT", label: "Document", colour: "#38bdf8", icon: "FileText" },
    { key: "ELECTRONIC", label: "Electronic", colour: "#a855f7", icon: "Laptop" },
    { key: "PHYSICAL", label: "Physical", colour: "#f59e0b", icon: "Boxes" },
    { key: "SAMPLE", label: "Sample", colour: "#22c55e", icon: "FlaskConical" },
  ],
  alert: [
    { key: "SAFETY", label: "Safety", colour: "#ef4444", icon: "ShieldAlert" },
    { key: "OPERATIONAL", label: "Operational", colour: "#38bdf8", icon: "Radio" },
    { key: "INFORMATION", label: "Information", colour: "#64748b", icon: "Info" },
  ],
};

// ---------------------------------------------------------------------------
// Priorities (presentation + ordering; statuses are fully configurable)
// ---------------------------------------------------------------------------

export const PRIORITY_LEVELS = [
  { key: "LOW", label: "Low", colour: "#64748b", weight: 1 },
  { key: "MEDIUM", label: "Medium", colour: "#38bdf8", weight: 2 },
  { key: "HIGH", label: "High", colour: "#f59e0b", weight: 3 },
  { key: "CRITICAL", label: "Critical", colour: "#ef4444", weight: 4 },
] as const;

export type PriorityKey = (typeof PRIORITY_LEVELS)[number]["key"];

export const DEFAULT_PRIORITY: PriorityKey = "MEDIUM";

// ---------------------------------------------------------------------------
// Terminology
// ---------------------------------------------------------------------------

export type TerminologySeed = { termKey: string; singular: string; plural: string };

export const DEFAULT_TERMINOLOGY: TerminologySeed[] = [
  { termKey: "person", singular: "Person", plural: "People" },
  { termKey: "vehicle", singular: "Vehicle", plural: "Vehicles" },
  { termKey: "incident", singular: "Incident", plural: "Incidents" },
  { termKey: "case", singular: "Case", plural: "Cases" },
  { termKey: "report", singular: "Report", plural: "Reports" },
  { termKey: "task", singular: "Task", plural: "Tasks" },
  { termKey: "unit", singular: "Unit", plural: "Units" },
  { termKey: "personnel", singular: "Personnel", plural: "Personnel" },
  { termKey: "department", singular: "Department", plural: "Departments" },
  { termKey: "warrant", singular: "Warrant", plural: "Warrants" },
  { termKey: "alert", singular: "Alert", plural: "Alerts" },
  { termKey: "bolo", singular: "BOLO", plural: "BOLOs" },
  { termKey: "evidence", singular: "Evidence", plural: "Evidence" },
  { termKey: "call", singular: "Call", plural: "Calls" },
  { termKey: "dispatch", singular: "Dispatch", plural: "Dispatch" },
  { termKey: "organisation", singular: "Organisation", plural: "Organisations" },
];

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

const without = (keys: string[]) => PERMISSION_KEYS.filter((key) => !keys.includes(key));

export type RoleSeed = {
  key: string;
  name: string;
  description: string;
  isDefault?: boolean;
  permissions: string[] | "all";
};

export const DEFAULT_ROLES: RoleSeed[] = [
  {
    key: "administrator",
    name: "Administrator",
    description: "Full configuration and operational access.",
    permissions: "all",
  },
  {
    key: "supervisor",
    name: "Supervisor",
    description: "Operational oversight including approvals and unit management.",
    permissions: without([
      "admin.users.manage",
      "admin.roles.manage",
      "admin.permissions.manage",
      "admin.modules.manage",
      "admin.navigation.manage",
      "admin.fields.manage",
      "admin.forms.manage",
      "admin.workflows.manage",
      "admin.statuses.manage",
      "admin.categories.manage",
      "admin.themes.manage",
      "admin.branding.manage",
      "admin.terminology.manage",
      "admin.integrations.manage",
      "admin.settings.manage",
      "admin.import.execute",
      "people.delete",
      "incidents.delete",
      "vehicles.delete",
      "evidence.delete",
    ]),
  },
  {
    key: "operator",
    name: "Operator",
    description: "Creates and manages operational records and dispatch activity.",
    permissions: [
      "dashboard.view",
      "search.use",
      "analytics.view",
      "people.view",
      "people.create",
      "people.edit",
      "people.export",
      "vehicles.view",
      "vehicles.create",
      "vehicles.edit",
      "incidents.view",
      "incidents.create",
      "incidents.edit",
      "incidents.assign",
      "incidents.export",
      "cases.view",
      "cases.create",
      "cases.edit",
      "calls.view",
      "calls.create",
      "calls.edit",
      "calls.close",
      "reports.view",
      "reports.create",
      "reports.edit",
      "reports.submit",
      "reports.export",
      "tasks.view",
      "tasks.create",
      "tasks.edit",
      "tasks.assign",
      "warrants.view",
      "alerts.view",
      "alerts.create",
      "alerts.edit",
      "alerts.acknowledge",
      "bolos.view",
      "bolos.create",
      "bolos.edit",
      "evidence.view",
      "evidence.create",
      "evidence.edit",
      "evidence.transfer",
      "units.view",
      "units.status",
      "dispatch.view",
      "dispatch.manage",
      "communications.view",
      "communications.send",
      "notifications.view",
      "timeline.view",
      "notes.create",
      "notes.edit",
      "notes.delete",
      "attachments.upload",
      "attachments.download",
    ],
  },
  {
    key: "standard",
    name: "Standard User",
    description: "Day-to-day user: reads records, creates reports and tasks.",
    isDefault: true,
    permissions: [
      "dashboard.view",
      "search.use",
      "people.view",
      "vehicles.view",
      "incidents.view",
      "cases.view",
      "reports.view",
      "reports.create",
      "reports.edit",
      "reports.submit",
      "tasks.view",
      "tasks.create",
      "tasks.edit",
      "warrants.view",
      "alerts.view",
      "bolos.view",
      "evidence.view",
      "units.view",
      "calls.view",
      "communications.view",
      "communications.send",
      "notifications.view",
      "timeline.view",
      "notes.create",
      "notes.edit",
      "attachments.upload",
      "attachments.download",
    ],
  },
  {
    key: "readonly",
    name: "Read Only",
    description: "View-only access across enabled modules.",
    permissions: [
      "dashboard.view",
      "search.use",
      "people.view",
      "vehicles.view",
      "incidents.view",
      "cases.view",
      "reports.view",
      "tasks.view",
      "warrants.view",
      "alerts.view",
      "bolos.view",
      "evidence.view",
      "units.view",
      "calls.view",
      "communications.view",
      "notifications.view",
      "timeline.view",
      "attachments.download",
    ],
  },
];

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export type NavigationSeed = {
  key: string;
  label: string;
  href: string;
  icon: string;
  moduleKey?: string;
  permission?: string;
  group: string;
  sortOrder: number;
  isSystem?: boolean;
};

export const DEFAULT_NAVIGATION: NavigationSeed[] = [
  { key: "nav.dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", moduleKey: "dashboard", permission: "dashboard.view", group: "main", sortOrder: 10, isSystem: true },
  { key: "nav.operations", label: "Operations", href: "/operations", icon: "Activity", moduleKey: "operations", permission: "dispatch.view", group: "main", sortOrder: 20 },
  { key: "nav.opsWall", label: "Ops Wall", href: "/ops", icon: "Radar", moduleKey: "ops-wall", permission: "dispatch.view", group: "main", sortOrder: 25 },
  { key: "nav.dispatch", label: "Dispatch", href: "/dispatch", icon: "RadioTower", moduleKey: "dispatch", permission: "dispatch.view", group: "main", sortOrder: 30 },
  { key: "nav.briefing", label: "Briefing", href: "/briefing", icon: "ClipboardList", moduleKey: "briefing", permission: "dispatch.view", group: "main", sortOrder: 35 },
  { key: "nav.units", label: "Units", href: "/units", icon: "Radio", moduleKey: "units", permission: "units.view", group: "main", sortOrder: 40 },
  { key: "nav.incidents", label: "Incidents", href: "/incidents", icon: "FileText", moduleKey: "incidents", permission: "incidents.view", group: "records", sortOrder: 50 },
  { key: "nav.cases", label: "Cases", href: "/cases", icon: "Briefcase", moduleKey: "cases", permission: "cases.view", group: "records", sortOrder: 60 },
  { key: "nav.people", label: "People", href: "/people", icon: "Users", moduleKey: "people", permission: "people.view", group: "records", sortOrder: 70 },
  { key: "nav.vehicles", label: "Vehicles", href: "/vehicles", icon: "Car", moduleKey: "vehicles", permission: "vehicles.view", group: "records", sortOrder: 80 },
  { key: "nav.associations", label: "Associations", href: "/associations", icon: "Network", moduleKey: "associations", permission: "search.use", group: "records", sortOrder: 95 },
  { key: "nav.reports", label: "Reports", href: "/reports", icon: "FileCheck", moduleKey: "reports", permission: "reports.view", group: "records", sortOrder: 100 },
  { key: "nav.evidence", label: "Evidence", href: "/evidence", icon: "Boxes", moduleKey: "evidence", permission: "evidence.view", group: "records", sortOrder: 100 },
  { key: "nav.tasks", label: "Tasks", href: "/tasks", icon: "CheckSquare", moduleKey: "tasks", permission: "tasks.view", group: "work", sortOrder: 110 },
  { key: "nav.warrants", label: "Warrants", href: "/warrants", icon: "Gavel", moduleKey: "warrants", permission: "warrants.view", group: "work", sortOrder: 120 },
  { key: "nav.alerts", label: "Alerts", href: "/alerts", icon: "BellRing", moduleKey: "alerts", permission: "alerts.view", group: "work", sortOrder: 130 },
  { key: "nav.bolos", label: "BOLOs", href: "/bolos", icon: "ScanEye", moduleKey: "bolos", permission: "bolos.view", group: "work", sortOrder: 140 },
  { key: "nav.communications", label: "Communications", href: "/communications", icon: "MessageSquare", moduleKey: "communications", permission: "communications.view", group: "work", sortOrder: 150 },
  { key: "nav.fivemPreview", label: "FiveM Preview", href: "/fivem-preview", icon: "Gamepad2", permission: "dispatch.view", group: "system", sortOrder: 850 },
  { key: "nav.admin", label: "Administration", href: "/admin", icon: "Settings", moduleKey: "admin", permission: "admin.access", group: "system", sortOrder: 900, isSystem: true },
];

// ---------------------------------------------------------------------------
// Dashboard widgets
// ---------------------------------------------------------------------------

export type WidgetSeed = {
  type: string;
  title: string;
  size: "small" | "medium" | "large";
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
};

export const DEFAULT_DASHBOARD_WIDGETS: WidgetSeed[] = [
  { type: "metric.activeIncidents", title: "Active Incidents", size: "small", x: 0, y: 0, w: 1, h: 1 },
  { type: "metric.openTasks", title: "Open Tasks", size: "small", x: 1, y: 0, w: 1, h: 1 },
  { type: "metric.activeUnits", title: "Available Units", size: "small", x: 2, y: 0, w: 1, h: 1 },
  { type: "metric.pendingReports", title: "Reports Pending", size: "small", x: 3, y: 0, w: 1, h: 1 },
  { type: "list.activeIncidents", title: "Active Incidents", size: "medium", x: 0, y: 1, w: 2, h: 2 },
  { type: "list.unitStatus", title: "Unit Status", size: "medium", x: 2, y: 1, w: 2, h: 2 },
  { type: "list.myTasks", title: "My Tasks", size: "medium", x: 0, y: 3, w: 2, h: 2 },
  { type: "list.recentRecords", title: "Recent Records", size: "medium", x: 2, y: 3, w: 2, h: 2 },
  { type: "chart.incidentTrend", title: "Incident Trend", size: "large", x: 0, y: 5, w: 4, h: 2 },
  { type: "list.notifications", title: "Notifications", size: "medium", x: 0, y: 7, w: 2, h: 2 },
  { type: "list.alerts", title: "Active Alerts", size: "medium", x: 2, y: 7, w: 2, h: 2 },
  { type: "chart.temporalHeatmap", title: "Demand By Day And Hour", size: "large", x: 0, y: 9, w: 4, h: 2 },
];

export const WIDGET_CATALOGUE: Array<{ type: string; label: string; description: string; minW: number; minH: number }> = [
  { type: "metric.activeIncidents", label: "Active incidents", description: "Count of incidents not in a closed status.", minW: 1, minH: 1 },
  { type: "metric.openTasks", label: "Open tasks", description: "Tasks assigned to you that are not completed.", minW: 1, minH: 1 },
  { type: "metric.activeUnits", label: "Available units", description: "Units currently available.", minW: 1, minH: 1 },
  { type: "metric.pendingReports", label: "Reports pending review", description: "Reports waiting for review or approval.", minW: 1, minH: 1 },
  { type: "metric.overdueTasks", label: "Overdue tasks", description: "Tasks past their due date.", minW: 1, minH: 1 },
  { type: "metric.evidenceInCustody", label: "Evidence in custody", description: "Evidence items currently held.", minW: 1, minH: 1 },
  { type: "list.activeIncidents", label: "Active incidents", description: "Latest open incidents.", minW: 2, minH: 2 },
  { type: "list.unitStatus", label: "Unit status", description: "Live unit status board.", minW: 2, minH: 2 },
  { type: "list.myTasks", label: "My tasks", description: "Tasks assigned to the current user.", minW: 2, minH: 2 },
  { type: "list.recentRecords", label: "Recent records", description: "Recently created records you can view.", minW: 2, minH: 2 },
  { type: "list.notifications", label: "Notifications", description: "Your latest notifications.", minW: 2, minH: 2 },
  { type: "list.alerts", label: "Active alerts", description: "Currently active alerts.", minW: 2, minH: 2 },
  { type: "list.pendingReports", label: "Pending reports", description: "Reports awaiting review.", minW: 2, minH: 2 },
  { type: "chart.incidentTrend", label: "Incident trend", description: "Incidents created per day (last 14 days).", minW: 3, minH: 2 },
  { type: "chart.incidentPriority", label: "Incidents by priority", description: "Distribution of open incidents by priority.", minW: 2, minH: 2 },
  { type: "chart.temporalHeatmap", label: "Demand by day and hour", description: "When incidents happen, binned by weekday and hour.", minW: 3, minH: 2 },
  { type: "ops.sectorMap", label: "Sector view", description: "Live schematic map of units and open incidents.", minW: 2, minH: 2 },
  { type: "quickActions", label: "Quick actions", description: "Shortcuts to common record creation.", minW: 2, minH: 1 },
];

// ---------------------------------------------------------------------------
// Operating area
// ---------------------------------------------------------------------------

/**
 * Districts of the demonstration city with their centroids.
 *
 * The console draws a schematic sector view rather than a street map, so all
 * that is needed is a stable centre for each district. The seeder uses the same
 * table to place records, which keeps the demo data and the map consistent.
 */
export const SECTOR_DISTRICTS: Array<{ name: string; latitude: number; longitude: number }> = [
  { name: "Northgate", latitude: 51.5273, longitude: -0.1466 },
  { name: "Ashcombe", latitude: 51.5421, longitude: -0.0985 },
  { name: "Kestrel Bay", latitude: 51.5089, longitude: -0.0612 },
  { name: "Ridgeway", latitude: 51.5194, longitude: -0.1745 },
  { name: "Harbour", latitude: 51.4962, longitude: -0.1089 },
  { name: "Silverport", latitude: 51.5117, longitude: -0.1841 },
  { name: "Ferndale", latitude: 51.5561, longitude: -0.1302 },
  { name: "South Quay", latitude: 51.4837, longitude: -0.0731 },
];

/** Centroid lookup by (case-insensitive) district name. */
export function districtCentroid(name: string | null | undefined): { name: string; latitude: number; longitude: number } | null {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  return SECTOR_DISTRICTS.find((district) => district.name.toLowerCase() === needle) ?? null;
}

/**
 * District mentioned in free text.
 *
 * Seeded records carry a location as text ("12 Harbour Road, Northgate"); this
 * resolves it to the sector the console plots, so the map and the records agree.
 */
export function districtFromText(text: string | null | undefined): { name: string; latitude: number; longitude: number } | null {
  if (!text) return null;
  const needle = text.toLowerCase();
  return SECTOR_DISTRICTS.find((district) => needle.includes(district.name.toLowerCase())) ?? null;
}
