/**
 * Module registry.
 *
 * Module metadata is code (it defines routes, icons and the permission each
 * module needs), while *whether a module is enabled* is data, managed by
 * administrators. `disabled` modules disappear from navigation and their
 * routes refuse to render or serve data.
 */
export type ModuleDefinition = {
  key: string;
  name: string;
  description: string;
  icon: string;
  href: string;
  /** Permission required to see the module in navigation and open its pages. */
  permission: string;
  /** Core modules cannot be disabled (the shell depends on them). */
  core?: boolean;
  group: "main" | "operations" | "records" | "admin";
  sortOrder: number;
};

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "dashboard",
    name: "Dashboard",
    description: "Configurable operational overview.",
    icon: "LayoutDashboard",
    href: "/dashboard",
    permission: "dashboard.view",
    core: true,
    group: "main",
    sortOrder: 10,
  },
  {
    key: "operations",
    name: "Operations",
    description: "Live view of active calls, units and assignments.",
    icon: "Activity",
    href: "/operations",
    permission: "dispatch.view",
    group: "operations",
    sortOrder: 20,
  },
  {
    key: "dispatch",
    name: "Dispatch",
    description: "Call handling and unit assignment.",
    icon: "RadioTower",
    href: "/dispatch",
    permission: "dispatch.view",
    group: "operations",
    sortOrder: 30,
  },
  {
    key: "units",
    name: "Units",
    description: "Unit roster, status and assignments.",
    icon: "Radio",
    href: "/units",
    permission: "units.view",
    group: "operations",
    sortOrder: 40,
  },
  {
    key: "incidents",
    name: "Incidents",
    description: "Incident records, participants and linked evidence.",
    icon: "FileText",
    href: "/incidents",
    permission: "incidents.view",
    group: "records",
    sortOrder: 50,
  },
  {
    key: "cases",
    name: "Cases",
    description: "Case management built on incidents and reports.",
    icon: "Briefcase",
    href: "/cases",
    permission: "cases.view",
    group: "records",
    sortOrder: 60,
  },
  {
    key: "people",
    name: "People",
    description: "Person records, identifiers, contacts and addresses.",
    icon: "Users",
    href: "/people",
    permission: "people.view",
    group: "records",
    sortOrder: 70,
  },
  {
    key: "vehicles",
    name: "Vehicles",
    description: "Vehicle records and ownership.",
    icon: "Car",
    href: "/vehicles",
    permission: "vehicles.view",
    group: "records",
    sortOrder: 80,
  },
  {
    key: "reports",
    name: "Reports",
    description: "Report drafting, submission, review and approval.",
    icon: "FileCheck",
    href: "/reports",
    permission: "reports.view",
    group: "records",
    sortOrder: 90,
  },
  {
    key: "tasks",
    name: "Tasks",
    description: "Task assignment and tracking.",
    icon: "CheckSquare",
    href: "/tasks",
    permission: "tasks.view",
    group: "records",
    sortOrder: 100,
  },
  {
    key: "warrants",
    name: "Warrants",
    description: "Warrant records and status.",
    icon: "Gavel",
    href: "/warrants",
    permission: "warrants.view",
    group: "records",
    sortOrder: 110,
  },
  {
    key: "alerts",
    name: "Alerts",
    description: "Operational alerts and acknowledgements.",
    icon: "BellRing",
    href: "/alerts",
    permission: "alerts.view",
    group: "operations",
    sortOrder: 120,
  },
  {
    key: "bolos",
    name: "BOLOs",
    description: "Be-on-the-lookout notices.",
    icon: "ScanEye",
    href: "/bolos",
    permission: "bolos.view",
    group: "operations",
    sortOrder: 130,
  },
  {
    key: "evidence",
    name: "Evidence",
    description: "Property and evidence with custody tracking.",
    icon: "Boxes",
    href: "/evidence",
    permission: "evidence.view",
    group: "records",
    sortOrder: 140,
  },
  {
    key: "communications",
    name: "Communications",
    description: "Channels, direct messages and mentions.",
    icon: "MessageSquare",
    href: "/communications",
    permission: "communications.view",
    group: "main",
    sortOrder: 150,
  },
  {
    key: "search",
    name: "Search",
    description: "Search across every record you can access.",
    icon: "Search",
    href: "/search",
    permission: "search.use",
    core: true,
    group: "main",
    sortOrder: 160,
  },
  {
    key: "ops-wall",
    name: "Ops Wall",
    description: "Live sector view, unit readiness and the event ticker.",
    icon: "Radar",
    href: "/ops",
    permission: "dispatch.view",
    group: "operations",
    sortOrder: 25,
  },
  {
    key: "briefing",
    name: "Shift Briefing",
    description: "Generated roll-call briefing for the last shift.",
    icon: "ClipboardList",
    href: "/briefing",
    permission: "dispatch.view",
    group: "operations",
    sortOrder: 45,
  },
  {
    key: "associations",
    name: "Associations",
    description: "Link analysis across people, vehicles, incidents, cases and evidence.",
    icon: "Network",
    href: "/associations",
    permission: "search.use",
    group: "records",
    sortOrder: 105,
  },
  {
    key: "admin",
    name: "Administration",
    description: "Configuration, users, roles and audit.",
    icon: "Settings",
    href: "/admin",
    permission: "admin.access",
    core: true,
    group: "admin",
    sortOrder: 900,
  },
];

export const MODULE_KEYS = MODULE_DEFINITIONS.map((module) => module.key);

export function getModuleDefinition(key: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find((module) => module.key === key);
}
