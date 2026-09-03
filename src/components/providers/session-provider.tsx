"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  jobTitle: string | null;
  badgeNumber: string | null;
  avatarUrl: string | null;
  status: string;
  departmentId: string | null;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  sessionExpiresAt: string;
};

export type NavItem = {
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

export type ModuleConfig = {
  key: string;
  name: string;
  description: string;
  icon: string;
  href: string;
  permission: string;
  core?: boolean;
  group: "main" | "operations" | "records" | "admin";
  sortOrder: number;
  enabled: boolean;
  dbId: string | null;
};

export type Branding = {
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

export type ShellData = {
  user: SessionUser;
  permissions: string[];
  roles: string[];
  /** How this deployment identifies the operator: no sign-in, or password. */
  security?: { authMode: "none" | "password" };
  config: {
    modules: ModuleConfig[];
    navigation: NavItem[];
    terminology: Record<string, { singular: string; plural: string }>;
    statuses: Record<string, Array<{ key: string; label: string; colour: string; isDefault: boolean; isClosed: boolean; sortOrder: number }>>;
    categories: Record<string, Array<{ key: string; label: string; colour: string }>>;
    branding: Branding;
    theme: ThemeConfig;
  };
  notifications: { unread: number; recent: Array<Record<string, unknown>> };
  tasks: { mine: Array<Record<string, unknown>> };
};

type SessionContextValue = {
  data: ShellData | null;
  user: SessionUser | null;
  permissions: Set<string>;
  roles: string[];
  loading: boolean;
  error: Error | null;
  can: (permission?: string | null) => boolean;
  canAny: (permissions: string[]) => boolean;
  term: (key: string, form?: "singular" | "plural", fallback?: string) => string;
  statusLabel: (resourceType: string, key: string | null | undefined) => string;
  statusColour: (resourceType: string, key: string | null | undefined) => string;
  refresh: () => Promise<unknown>;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children, initialData }: { children: React.ReactNode; initialData?: ShellData | null }) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["session", "shell"],
    queryFn: () => api.get<ShellData>("/api/shell"),
    initialData: initialData ?? undefined,
    staleTime: 30_000,
    retry: false,
  });

  const permissions = React.useMemo(() => new Set(data?.permissions ?? []), [data?.permissions]);

  const value = React.useMemo<SessionContextValue>(
    () => ({
      data: data ?? null,
      user: data?.user ?? null,
      permissions,
      roles: data?.roles ?? [],
      loading: isLoading,
      error: (error as Error | null) ?? null,
      can: (permission) => (permission ? permissions.has(permission) : true),
      canAny: (list) => (list.length === 0 ? true : list.some((permission) => permissions.has(permission))),
      term: (key, form = "singular", fallback) => {
        const entry = data?.config?.terminology?.[key];
        if (!entry) return fallback ?? key;
        return form === "plural" ? entry.plural : entry.singular;
      },
      statusLabel: (resourceType, key) => {
        if (!key) return "—";
        const options = data?.config?.statuses?.[resourceType];
        return options?.find((option) => option.key === key)?.label ?? key.replace(/_/g, " ");
      },
      statusColour: (resourceType, key) => {
        if (!key) return "#64748b";
        const options = data?.config?.statuses?.[resourceType];
        return options?.find((option) => option.key === key)?.colour ?? "#64748b";
      },
      refresh: () => queryClient.invalidateQueries({ queryKey: ["session", "shell"] }),
    }),
    [data, error, isLoading, permissions, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within a SessionProvider.");
  return context;
}

/** Visibility-only permission check for UI code. Server always re-checks. */
export function useCan(permission?: string | null): boolean {
  const { can } = useSession();
  return can(permission);
}

/** Configured status options for a record type (empty while loading). */
export function useStatusOptions(resourceType: string): Array<{ key: string; label: string; colour: string }> {
  const { data } = useSession();
  return data?.config?.statuses?.[resourceType] ?? [];
}

/** Configured category options for a record type. */
export function useCategoryOptions(resourceType: string): Array<{ key: string; label: string; colour: string }> {
  const { data } = useSession();
  return data?.config?.categories?.[resourceType] ?? [];
}

export function useTerminology() {
  const { term } = useSession();
  return term;
}
