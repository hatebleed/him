import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { DEFAULT_CATEGORIES, DEFAULT_STATUSES, DEFAULT_TERMINOLOGY } from "@/config/defaults";
import { MODULE_DEFINITIONS, type ModuleDefinition } from "@/config/modules";
import { db } from "@/lib/db/client";
import {
  categoryDefinitions,
  customFieldDefinitions,
  modules as modulesTable,
  navigationItems,
  organisationSettings,
  statusDefinitions,
  systemSettings,
  terminologyEntries,
  themeSettings,
} from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { getOptionalContext } from "@/server/context";

/**
 * ---------------------------------------------------------------------------
 * Configuration engine
 * ---------------------------------------------------------------------------
 * One place that answers "how should the platform behave for this
 * organisation?". Values live in PostgreSQL; lookups are cached per process
 * with a short TTL and invalidated on every write so an administrator sees
 * the effect of a change immediately.
 */

export type StatusOption = {
  key: string;
  label: string;
  colour: string;
  icon: string | null;
  isDefault: boolean;
  isClosed: boolean;
  sortOrder: number;
};

export type CategoryOption = {
  key: string;
  label: string;
  colour: string;
  icon: string | null;
  sortOrder: number;
};

export type CustomFieldOption = {
  id: string;
  key: string;
  label: string;
  type: string;
  section: string | null;
  helpText: string | null;
  placeholder: string | null;
  required: boolean;
  defaultValue: string | null;
  options: Array<{ label: string; value: string }> | null;
  validation: { min?: number; max?: number; pattern?: string; message?: string } | null;
  conditions: Array<{ field: string; operator: string; value: string }> | null;
  showInList: boolean;
  sortOrder: number;
};

export type TerminologyMap = Record<string, { singular: string; plural: string }>;

export type NavItemConfig = {
  key: string;
  label: string;
  href: string | null;
  icon: string | null;
  moduleKey: string | null;
  permission: string | null;
  group: string;
  sortOrder: number;
  enabled: boolean;
};

export type BrandingConfig = {
  organisationName: string;
  organisationShort: string | null;
  tagline: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginBackgroundUrl: string | null;
  primaryColour: string;
  accentColour: string;
  sidebarColour: string;
};

export type ThemeConfig = {
  mode: string;
  accentColour: string;
  density: string;
  radius: string;
  sidebarStyle: string;
  fontFamily: string;
  motion: string;
};

export type ModuleConfig = ModuleDefinition & { enabled: boolean; dbId: string | null };

const CACHE_TTL_MS = 15_000;

type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await loader();
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

export function invalidateConfiguration(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export async function getModules(): Promise<ModuleConfig[]> {
  return cached("modules", async () => {
    const rows = await db.select().from(modulesTable);
    const byKey = new Map(rows.map((row) => [row.key, row] as const));
    return MODULE_DEFINITIONS.map((definition) => {
      const row = byKey.get(definition.key);
      return { ...definition, enabled: row?.enabled ?? !definition.core, dbId: row?.id ?? null };
    }).sort((a, b) => a.sortOrder - b.sortOrder);
  });
}

export async function getModule(key: string): Promise<ModuleConfig | undefined> {
  const all = await getModules();
  return all.find((entry) => entry.key === key);
}

export async function isModuleEnabled(key: string): Promise<boolean> {
  const entry = await getModule(key);
  return entry?.enabled ?? false;
}

export async function setModuleEnabled(key: string, enabled: boolean): Promise<void> {
  const definition = MODULE_DEFINITIONS.find((module) => module.key === key);
  if (!definition) throw new Error(`Unknown module "${key}"`);
  if (definition.core && !enabled) {
    // Core modules keep the shell usable (dashboard/search/admin).
    throw new Error(`The "${definition.name}" module is required and cannot be disabled.`);
  }
  await db
    .insert(modulesTable)
    .values({ key, name: definition.name, description: definition.description, icon: definition.icon, enabled })
    .onConflictDoUpdate({ target: modulesTable.key, set: { enabled } });
  invalidateConfiguration("modules");
  invalidateConfiguration("navigation");
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export async function getNavigation(): Promise<NavItemConfig[]> {
  return cached("navigation", async () => {
    const rows = await db.select().from(navigationItems).orderBy(asc(navigationItems.sortOrder));
    if (rows.length === 0) {
      // Fall back to the code-level defaults until an administrator edits them.
      const moduleRows = await db.select().from(modulesTable);
      const moduleState = new Map(moduleRows.map((row) => [row.key, row.enabled] as const));
      const { DEFAULT_NAVIGATION } = await import("@/config/defaults");
      return DEFAULT_NAVIGATION.map((item) => ({
        key: item.key,
        label: item.label,
        href: item.href,
        icon: item.icon,
        moduleKey: item.moduleKey ?? null,
        permission: item.permission ?? null,
        group: item.group,
        sortOrder: item.sortOrder,
        enabled: item.moduleKey ? moduleState.get(item.moduleKey) ?? true : true,
      }));
    }
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      href: row.href,
      icon: row.icon,
      moduleKey: row.moduleKey,
      permission: row.permission,
      group: row.group ?? "main",
      sortOrder: row.sortOrder,
      enabled: row.enabled,
    }));
  });
}

export async function setNavigationEnabled(key: string, enabled: boolean): Promise<void> {
  await db.update(navigationItems).set({ enabled }).where(eq(navigationItems.key, key));
  invalidateConfiguration("navigation");
}

export const navigationItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  href: z.string().nullish(),
  icon: z.string().nullish(),
  moduleKey: z.string().nullish(),
  permission: z.string().nullish(),
  group: z.string().default("main"),
  sortOrder: z.number().default(100),
  enabled: z.boolean().default(true),
});

export async function upsertNavigationItem(input: z.input<typeof navigationItemSchema>): Promise<void> {
  await db
    .insert(navigationItems)
    .values({
      key: input.key,
      label: input.label,
      href: input.href,
      icon: input.icon,
      moduleKey: input.moduleKey ?? null,
      permission: input.permission ?? null,
      group: input.group ?? "main",
      sortOrder: input.sortOrder ?? 100,
      enabled: input.enabled ?? true,
    })
    .onConflictDoUpdate({
      target: navigationItems.key,
      set: {
        label: input.label,
        href: input.href,
        icon: input.icon,
        moduleKey: input.moduleKey ?? null,
        permission: input.permission ?? null,
        group: input.group ?? "main",
        sortOrder: input.sortOrder ?? 100,
        enabled: input.enabled ?? true,
      },
    });
  invalidateConfiguration("navigation");
}

export async function deleteNavigationItem(key: string): Promise<void> {
  await db.delete(navigationItems).where(eq(navigationItems.key, key));
  invalidateConfiguration("navigation");
}

// ---------------------------------------------------------------------------
// Terminology
// ---------------------------------------------------------------------------

export async function getTerminology(): Promise<TerminologyMap> {
  return cached("terminology", async () => {
    const rows = await db.select().from(terminologyEntries);
    if (rows.length === 0) {
      return Object.fromEntries(DEFAULT_TERMINOLOGY.map((entry) => [entry.termKey, { singular: entry.singular, plural: entry.plural }]));
    }
    return Object.fromEntries(rows.map((row) => [row.termKey, { singular: row.singular, plural: row.plural }]));
  });
}

export async function setTerminology(termKey: string, singular: string, plural: string): Promise<void> {
  await db
    .insert(terminologyEntries)
    .values({ termKey, singular, plural })
    .onConflictDoUpdate({ target: terminologyEntries.termKey, set: { singular, plural } });
  invalidateConfiguration("terminology");
}

/** Resolves a term for display, falling back to a sensible label. */
export async function term(key: string, form: "singular" | "plural" = "singular", fallback?: string): Promise<string> {
  const map = await getTerminology();
  return map[key]?.[form] ?? fallback ?? key;
}

// ---------------------------------------------------------------------------
// Statuses and categories
// ---------------------------------------------------------------------------

export async function getStatuses(resourceType: string): Promise<StatusOption[]> {
  return cached(`statuses:${resourceType}`, async () => {
    const rows = await db
      .select()
      .from(statusDefinitions)
      .where(eq(statusDefinitions.resourceType, resourceType))
      .orderBy(asc(statusDefinitions.sortOrder));
    if (rows.length === 0) {
      const defaults = DEFAULT_STATUSES[resourceType] ?? [];
      return defaults.map((entry, index) => ({
        key: entry.key,
        label: entry.label,
        colour: entry.colour,
        icon: null,
        isDefault: entry.isDefault ?? index === 0,
        isClosed: entry.isClosed ?? false,
        sortOrder: index,
      }));
    }
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      colour: row.colour,
      icon: row.icon,
      isDefault: row.isDefault,
      isClosed: row.isClosed,
      sortOrder: row.sortOrder,
    }));
  });
}

export async function getStatusMap(resourceTypes: string[]): Promise<Record<string, StatusOption[]>> {
  const entries = await Promise.all(resourceTypes.map(async (type) => [type, await getStatuses(type)] as const));
  return Object.fromEntries(entries);
}

export async function getDefaultStatus(resourceType: string): Promise<string | null> {
  const statuses = await getStatuses(resourceType);
  return (statuses.find((status) => status.isDefault) ?? statuses[0])?.key ?? null;
}

export async function getClosedStatuses(resourceType: string): Promise<string[]> {
  const statuses = await getStatuses(resourceType);
  return statuses.filter((status) => status.isClosed).map((status) => status.key);
}

export async function getCategories(resourceType: string): Promise<CategoryOption[]> {
  return cached(`categories:${resourceType}`, async () => {
    const rows = await db
      .select()
      .from(categoryDefinitions)
      .where(eq(categoryDefinitions.resourceType, resourceType))
      .orderBy(asc(categoryDefinitions.sortOrder));
    if (rows.length === 0) {
      return (DEFAULT_CATEGORIES[resourceType] ?? []).map((entry, index) => ({
        key: entry.key,
        label: entry.label,
        colour: entry.colour,
        icon: entry.icon ?? null,
        sortOrder: index,
      }));
    }
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      colour: row.colour,
      icon: row.icon,
      sortOrder: row.sortOrder,
    }));
  });
}

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

export async function getCustomFields(resourceType: string): Promise<CustomFieldOption[]> {
  return cached(`custom-fields:${resourceType}`, async () => {
    const rows = await db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.resourceType, resourceType))
      .orderBy(asc(customFieldDefinitions.sortOrder));
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      type: row.type,
      section: row.section,
      helpText: row.helpText,
      placeholder: row.placeholder,
      required: row.required,
      defaultValue: row.defaultValue,
      options: row.options ?? null,
      validation: row.validation ?? null,
      conditions: row.conditions ?? null,
      showInList: row.showInList,
      sortOrder: row.sortOrder,
    }));
  });
}

// ---------------------------------------------------------------------------
// Branding, theme, system settings
// ---------------------------------------------------------------------------

export async function getBranding(): Promise<BrandingConfig> {
  return cached("branding", async () => {
    const [row] = await db.select().from(organisationSettings).limit(1);
    if (!row) {
      return {
        organisationName: "Northgate Operations",
        organisationShort: "NGO",
        tagline: "Operational information platform",
        contactEmail: null,
        contactPhone: null,
        address: null,
        logoUrl: null,
        faviconUrl: null,
        loginBackgroundUrl: null,
        primaryColour: "#3b82f6",
        accentColour: "#22d3ee",
        sidebarColour: "#0b1220",
      };
    }
    return {
      organisationName: row.organisationName,
      organisationShort: row.organisationShort,
      tagline: row.tagline,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      address: row.address,
      logoUrl: row.logoUrl,
      faviconUrl: row.faviconUrl,
      loginBackgroundUrl: row.loginBackgroundUrl,
      primaryColour: row.primaryColour,
      accentColour: row.accentColour,
      sidebarColour: row.sidebarColour,
    };
  });
}

export async function updateBranding(values: Partial<BrandingConfig>): Promise<BrandingConfig> {
  const existing = await db.select().from(organisationSettings).limit(1);
  const context = getOptionalContext();
  if (existing[0]) {
    await db
      .update(organisationSettings)
      .set({ ...values, updatedById: context?.user.id ?? null })
      .where(eq(organisationSettings.id, existing[0].id));
  } else {
    await db.insert(organisationSettings).values({ key: "default", ...values, updatedById: context?.user.id ?? null });
  }
  invalidateConfiguration("branding");
  return getBranding();
}

export async function getTheme(): Promise<ThemeConfig> {
  return cached("theme", async () => {
    const [row] = await db.select().from(themeSettings).limit(1);
    if (!row) {
      return {
        mode: "dark",
        accentColour: "#3b82f6",
        density: "comfortable",
        radius: "0.6rem",
        sidebarStyle: "default",
        fontFamily: "inter",
        motion: "full",
      };
    }
    return {
      mode: row.mode,
      accentColour: row.accentColour,
      density: row.density,
      radius: row.radius,
      sidebarStyle: row.sidebarStyle,
      fontFamily: row.fontFamily,
      motion: row.motion,
    };
  });
}

export async function updateTheme(values: Partial<ThemeConfig>): Promise<ThemeConfig> {
  const existing = await db.select().from(themeSettings).limit(1);
  const context = getOptionalContext();
  if (existing[0]) {
    await db.update(themeSettings).set({ ...values, updatedById: context?.user.id ?? null }).where(eq(themeSettings.id, existing[0].id));
  } else {
    await db.insert(themeSettings).values({ key: "default", ...values, updatedById: context?.user.id ?? null });
  }
  invalidateConfiguration("theme");
  return getTheme();
}

export type SettingValue = string | number | boolean | null | Array<unknown> | Record<string, unknown>;

export async function getSetting<T extends SettingValue>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  if (!row) return fallback;
  return (row.value as T) ?? fallback;
}

export async function setSetting(key: string, value: SettingValue, description?: string): Promise<void> {
  const context = getOptionalContext();
  await db
    .insert(systemSettings)
    .values({ key, value: value as never, description: description ?? null, updatedById: context?.user.id ?? null })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: value as never, updatedById: context?.user.id ?? null, description: description ?? null },
    });
  invalidateConfiguration(`setting:${key}`);
}

export async function listSettings(): Promise<Array<{ key: string; value: SettingValue; description: string | null }>> {
  const rows = await db.select().from(systemSettings).orderBy(asc(systemSettings.key));
  return rows.map((row) => ({ key: row.key, value: row.value as SettingValue, description: row.description }));
}

/** Everything the client shell needs in a single payload. */
export async function getShellConfiguration() {
  const [moduleList, navigation, terminology, branding, theme, statuses, categories] = await Promise.all([
    getModules(),
    getNavigation(),
    getTerminology(),
    getBranding(),
    getTheme(),
    getStatusMap(["incident", "case", "report", "task", "person", "vehicle", "warrant", "alert", "bolo", "evidence", "unit", "call"]),
    getCategories("incident"),
  ]);
  return { modules: moduleList, navigation, terminology, branding, theme, statuses, categories };
}

export async function preloadConfiguration(): Promise<void> {
  try {
    await getShellConfiguration();
  } catch (error) {
    logger.warn("Configuration preload failed", { error: (error as Error).message });
  }
}

export const configuration = {
  getModules,
  getModule,
  isModuleEnabled,
  getNavigation,
  getTerminology,
  getStatuses,
  getStatusMap,
  getDefaultStatus,
  getClosedStatuses,
  getCategories,
  getCustomFields,
  getBranding,
  getTheme,
  getSetting,
  setSetting,
  invalidate: invalidateConfiguration,
};

export const __testing = { invalidateConfiguration, cached, inArray };
