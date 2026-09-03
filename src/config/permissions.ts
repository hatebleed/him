/**
 * The permission catalogue.
 *
 * Permissions use `resource.action` semantics and are stored in the database
 * so administrators can extend them. This catalogue is the seed of truth and
 * is used to (re)concile rows on migration/seed.
 */
export type PermissionDefinition = {
  key: string;
  resource: string;
  action: string;
  category: string;
  description: string;
};

function perm(resource: string, actions: string[], category: string, descriptions: Record<string, string> = {}): PermissionDefinition[] {
  return actions.map((action) => ({
    key: `${resource}.${action}`,
    resource,
    action,
    category,
    description: descriptions[action] ?? `${action} ${resource}`,
  }));
}

export const PERMISSION_CATALOGUE: PermissionDefinition[] = [
  ...perm("dashboard", ["view"], "General", { view: "View the dashboard" }),
  ...perm("search", ["use"], "General", { use: "Use global search" }),
  ...perm("analytics", ["view"], "General", { view: "View analytics widgets" }),
  ...perm("people", ["view", "create", "edit", "delete", "export", "import"], "Records", {
    view: "View people records",
    create: "Create people records",
    edit: "Edit people records",
    delete: "Delete people records",
    export: "Export people records",
    import: "Import people records",
  }),
  ...perm("vehicles", ["view", "create", "edit", "delete", "export", "import"], "Records"),
  ...perm("incidents", ["view", "create", "edit", "delete", "assign", "close", "export"], "Operations", {
    assign: "Assign units and personnel to incidents",
    close: "Close incidents",
  }),
  ...perm("cases", ["view", "create", "edit", "delete", "close"], "Operations"),
  ...perm("calls", ["view", "create", "edit", "close"], "Dispatch"),
  ...perm("reports", ["view", "create", "edit", "delete", "submit", "review", "approve", "export"], "Reporting", {
    submit: "Submit a report for review",
    review: "Review submitted reports",
    approve: "Approve or reject reports",
  }),
  ...perm("tasks", ["view", "create", "edit", "delete", "assign"], "Tasks"),
  ...perm("warrants", ["view", "create", "edit", "delete"], "Records"),
  ...perm("alerts", ["view", "create", "edit", "delete", "acknowledge"], "Operations"),
  ...perm("bolos", ["view", "create", "edit", "delete"], "Operations"),
  ...perm("evidence", ["view", "create", "edit", "delete", "transfer"], "Records", {
    transfer: "Record custody transfers for evidence",
  }),
  ...perm("units", ["view", "edit", "status", "manage"], "Dispatch", {
    status: "Change unit status",
    manage: "Create and configure units",
  }),
  ...perm("dispatch", ["view", "manage"], "Dispatch"),
  ...perm("communications", ["view", "send", "manage"], "Communications"),
  ...perm("notifications", ["view"], "Communications"),
  ...perm("timeline", ["view"], "Records"),
  ...perm("notes", ["create", "edit", "delete"], "Records"),
  ...perm("attachments", ["upload", "download", "delete"], "Records"),
  ...perm("admin", ["access"], "Administration", { access: "Open the administration section" }),
  ...perm("admin.users", ["manage"], "Administration", { manage: "Create, edit, disable and reset users" }),
  ...perm("admin.roles", ["manage"], "Administration", { manage: "Manage roles and role permissions" }),
  ...perm("admin.permissions", ["manage"], "Administration"),
  ...perm("admin.departments", ["manage"], "Administration"),
  ...perm("admin.units", ["manage"], "Administration"),
  ...perm("admin.modules", ["manage"], "Administration", { manage: "Enable, disable and reorder modules" }),
  ...perm("admin.navigation", ["manage"], "Administration"),
  ...perm("admin.fields", ["manage"], "Administration", { manage: "Manage custom fields" }),
  ...perm("admin.forms", ["manage"], "Administration", { manage: "Build and publish forms" }),
  ...perm("admin.workflows", ["manage"], "Administration", { manage: "Build workflows" }),
  ...perm("admin.statuses", ["manage"], "Administration"),
  ...perm("admin.categories", ["manage"], "Administration"),
  ...perm("admin.dashboards", ["manage"], "Administration"),
  ...perm("admin.themes", ["manage"], "Administration"),
  ...perm("admin.branding", ["manage"], "Administration"),
  ...perm("admin.terminology", ["manage"], "Administration", { manage: "Rename system concepts" }),
  ...perm("admin.notifications", ["manage"], "Administration"),
  ...perm("admin.integrations", ["manage"], "Administration"),
  ...perm("admin.settings", ["manage"], "Administration"),
  ...perm("admin.import", ["execute"], "Administration"),
  ...perm("admin.audit", ["view"], "Administration", { view: "View the audit trail" }),
];

export const PERMISSION_KEYS = PERMISSION_CATALOGUE.map((permission) => permission.key);

export const PERMISSIONS_BY_CATEGORY = PERMISSION_CATALOGUE.reduce<Record<string, PermissionDefinition[]>>(
  (acc, permission) => {
    acc[permission.category] = acc[permission.category] ?? [];
    acc[permission.category]!.push(permission);
    return acc;
  },
  {},
);

export function isKnownPermission(key: string): boolean {
  return PERMISSION_KEYS.includes(key);
}
