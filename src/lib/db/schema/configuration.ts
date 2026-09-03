import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { createdAt, id, updatedAt } from "./shared";

/**
 * The configuration engine. Everything an administrator can change without
 * deploying code lives here: modules, navigation, terminology, statuses,
 * categories, custom fields, forms, workflows, dashboards and branding.
 */

export const systemSettings = pgTable(
  "system_settings",
  {
    id: id(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    description: text("description"),
    updatedAt: updatedAt(),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("system_settings_key_unique").on(table.key)],
);

export const organisationSettings = pgTable(
  "organisation_settings",
  {
    id: id(),
    key: text("key").notNull().default("default"),
    organisationName: text("organisation_name").notNull().default("Northgate Operations"),
    organisationShort: text("organisation_short"),
    tagline: text("tagline"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    address: text("address"),
    logoUrl: text("logo_url"),
    faviconUrl: text("favicon_url"),
    loginBackgroundUrl: text("login_background_url"),
    primaryColour: text("primary_colour").notNull().default("#3b82f6"),
    accentColour: text("accent_colour").notNull().default("#22d3ee"),
    sidebarColour: text("sidebar_colour").notNull().default("#0b1220"),
    updatedAt: updatedAt(),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("organisation_settings_key_unique").on(table.key)],
);

export const themeSettings = pgTable(
  "theme_settings",
  {
    id: id(),
    key: text("key").notNull().default("default"),
    mode: text("mode").notNull().default("dark"),
    accentColour: text("accent_colour").notNull().default("#3b82f6"),
    density: text("density").notNull().default("comfortable"),
    radius: text("radius").notNull().default("0.6rem"),
    sidebarStyle: text("sidebar_style").notNull().default("default"),
    fontFamily: text("font_family").notNull().default("inter"),
    motion: text("motion").notNull().default("full"),
    updatedAt: updatedAt(),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("theme_settings_key_unique").on(table.key)],
);

export const modules = pgTable(
  "modules",
  {
    id: id(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    enabled: boolean("enabled").notNull().default(true),
    isCore: boolean("is_core").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    settings: jsonb("settings"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("modules_key_unique").on(table.key), index("modules_enabled_idx").on(table.enabled)],
);

export const navigationItems = pgTable(
  "navigation_items",
  {
    id: id(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    href: text("href"),
    icon: text("icon"),
    moduleKey: text("module_key"),
    parentId: text("parent_id"),
    permission: text("permission"),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
    group: text("group").default("main"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("navigation_items_key_unique").on(table.key),
    index("navigation_items_parent_idx").on(table.parentId),
  ],
);

export const terminologyEntries = pgTable(
  "terminology_entries",
  {
    id: id(),
    termKey: text("term_key").notNull(),
    singular: text("singular").notNull(),
    plural: text("plural").notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("terminology_term_key_unique").on(table.termKey)],
);

export const statusDefinitions = pgTable(
  "status_definitions",
  {
    id: id(),
    resourceType: text("resource_type").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    colour: text("colour").notNull().default("#64748b"),
    icon: text("icon"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    isClosed: boolean("is_closed").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("status_definition_unique").on(table.resourceType, table.key),
    index("status_definition_type_idx").on(table.resourceType),
  ],
);

export const categoryDefinitions = pgTable(
  "category_definitions",
  {
    id: id(),
    resourceType: text("resource_type").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    colour: text("colour").notNull().default("#64748b"),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("category_definition_unique").on(table.resourceType, table.key),
    index("category_definition_type_idx").on(table.resourceType),
  ],
);

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: id(),
    resourceType: text("resource_type").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: text("type").notNull().default("TEXT"),
    section: text("section"),
    helpText: text("help_text"),
    placeholder: text("placeholder"),
    required: boolean("required").notNull().default(false),
    defaultValue: text("default_value"),
    options: jsonb("options").$type<Array<{ label: string; value: string }>>(),
    validation: jsonb("validation").$type<{ min?: number; max?: number; pattern?: string; message?: string }>(),
    conditions: jsonb("conditions").$type<Array<{ field: string; operator: string; value: string }>>(),
    showInList: boolean("show_in_list").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("custom_field_definition_unique").on(table.resourceType, table.key),
    index("custom_field_definition_type_idx").on(table.resourceType, table.active),
  ],
);

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    id: id(),
    definitionId: text("definition_id")
      .notNull()
      .references(() => customFieldDefinitions.id, { onDelete: "cascade" }),
    recordId: text("record_id").notNull(),
    value: text("value"),
    valueJson: jsonb("value_json"),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("custom_field_value_unique").on(table.definitionId, table.recordId),
    index("custom_field_value_record_idx").on(table.recordId),
  ],
);

export const forms = pgTable(
  "forms",
  {
    id: id(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    resourceType: text("resource_type").notNull(),
    status: text("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("forms_key_unique").on(table.key), index("forms_resource_type_idx").on(table.resourceType)],
);

export const formFields = pgTable(
  "form_fields",
  {
    id: id(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: text("type").notNull().default("TEXT"),
    section: text("section"),
    helpText: text("help_text"),
    placeholder: text("placeholder"),
    required: boolean("required").notNull().default(false),
    defaultValue: text("default_value"),
    options: jsonb("options").$type<Array<{ label: string; value: string }>>(),
    validation: jsonb("validation").$type<{ min?: number; max?: number; pattern?: string; message?: string }>(),
    conditions: jsonb("conditions").$type<Array<{ field: string; operator: string; value: string }>>(),
    width: text("width").notNull().default("full"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("form_field_unique").on(table.formId, table.key), index("form_field_form_idx").on(table.formId)],
);

export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: id(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    recordType: text("record_type"),
    recordId: text("record_id"),
    version: integer("version").notNull().default(1),
    data: jsonb("data").notNull(),
    status: text("status").notNull().default("SUBMITTED"),
    submittedById: text("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("form_submission_form_idx").on(table.formId),
    index("form_submission_record_idx").on(table.recordType, table.recordId),
  ],
);

export const workflows = pgTable(
  "workflows",
  {
    id: id(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    resourceType: text("resource_type").notNull(),
    trigger: text("trigger").notNull().default("RECORD_CREATED"),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("workflows_key_unique").on(table.key),
    index("workflows_resource_idx").on(table.resourceType, table.enabled),
  ],
);

export const workflowConditions = pgTable(
  "workflow_conditions",
  {
    id: id(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    operator: text("operator").notNull().default("EQUALS"),
    value: text("value"),
    conjunction: text("conjunction").notNull().default("AND"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("workflow_condition_workflow_idx").on(table.workflowId)],
);

export const workflowActions = pgTable(
  "workflow_actions",
  {
    id: id(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    config: jsonb("config").notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("workflow_action_workflow_idx").on(table.workflowId)],
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: id(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull().default("SUCCESS"),
    result: jsonb("result"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("workflow_run_record_idx").on(table.resourceType, table.resourceId),
    index("workflow_run_started_idx").on(table.startedAt),
  ],
);

export const dashboards = pgTable(
  "dashboards",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Default"),
    isDefault: boolean("is_default").notNull().default(false),
    isShared: boolean("is_shared").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("dashboards_user_idx").on(table.userId)],
);

export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: id(),
    dashboardId: text("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title"),
    config: jsonb("config"),
    size: text("size").notNull().default("medium"),
    visible: boolean("visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    w: integer("w").notNull().default(1),
    h: integer("h").notNull().default(1),
  },
  (table) => [index("dashboard_widget_dashboard_idx").on(table.dashboardId)],
);

export const savedViews = pgTable(
  "saved_views",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    name: text("name").notNull(),
    config: jsonb("config").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("saved_view_user_idx").on(table.userId, table.resourceType)],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    filters: jsonb("filters"),
    createdAt: createdAt(),
  },
  (table) => [index("saved_search_user_idx").on(table.userId, table.createdAt)],
);

export const formsRelations = relations(forms, ({ many }) => ({
  fields: many(formFields),
  submissions: many(formSubmissions),
}));

export const formFieldsRelations = relations(formFields, ({ one }) => ({
  form: one(forms, { fields: [formFields.formId], references: [forms.id] }),
}));

export const workflowsRelations = relations(workflows, ({ many }) => ({
  conditions: many(workflowConditions),
  actions: many(workflowActions),
}));

export const workflowConditionsRelations = relations(workflowConditions, ({ one }) => ({
  workflow: one(workflows, { fields: [workflowConditions.workflowId], references: [workflows.id] }),
}));

export const workflowActionsRelations = relations(workflowActions, ({ one }) => ({
  workflow: one(workflows, { fields: [workflowActions.workflowId], references: [workflows.id] }),
}));

export const dashboardsRelations = relations(dashboards, ({ many }) => ({
  widgets: many(dashboardWidgets),
}));

export const dashboardWidgetsRelations = relations(dashboardWidgets, ({ one }) => ({
  dashboard: one(dashboards, { fields: [dashboardWidgets.dashboardId], references: [dashboards.id] }),
}));

export const customFieldDefinitionsRelations = relations(customFieldDefinitions, ({ many }) => ({
  values: many(customFieldValues),
}));

export const customFieldValuesRelations = relations(customFieldValues, ({ one }) => ({
  definition: one(customFieldDefinitions, {
    fields: [customFieldValues.definitionId],
    references: [customFieldDefinitions.id],
  }),
}));

export type SystemSetting = typeof systemSettings.$inferSelect;
export type OrganisationSetting = typeof organisationSettings.$inferSelect;
export type ThemeSetting = typeof themeSettings.$inferSelect;
export type ModuleRecord = typeof modules.$inferSelect;
export type NavigationItem = typeof navigationItems.$inferSelect;
export type TerminologyEntry = typeof terminologyEntries.$inferSelect;
export type StatusDefinition = typeof statusDefinitions.$inferSelect;
export type CategoryDefinition = typeof categoryDefinitions.$inferSelect;
export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;
export type CustomFieldValue = typeof customFieldValues.$inferSelect;
export type Form = typeof forms.$inferSelect;
export type FormField = typeof formFields.$inferSelect;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowCondition = typeof workflowConditions.$inferSelect;
export type WorkflowAction = typeof workflowActions.$inferSelect;
export type Dashboard = typeof dashboards.$inferSelect;
export type DashboardWidget = typeof dashboardWidgets.$inferSelect;
export type SavedView = typeof savedViews.$inferSelect;
