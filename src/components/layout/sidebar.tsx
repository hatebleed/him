"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSession, type NavItem } from "@/components/providers/session-provider";
import { Badge, Button, Separator, Skeleton } from "@/components/ui/primitives";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/overlays";
import { dynamicIcon } from "@/components/icon";

const GROUP_LABELS: Record<string, string> = {
  main: "Overview",
  operations: "Operations",
  records: "Records",
  work: "Work",
  system: "System",
};

/**
 * Sidebar navigation.
 *
 * Items come from the database (administrators reorder, rename and disable
 * them) and are filtered here by permission for visibility only — opening a
 * route without the permission is refused by the server.
 */
export function Sidebar({
  items,
  collapsed,
  onToggle,
}: {
  items: NavItem[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { data, can, term } = useSession();
  const pathname = usePathname();

  if (!data) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const visible = items
    .filter((item) => item.enabled && (!item.permission || can(item.permission)))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const groups = visible.reduce<Record<string, NavItem[]>>((acc, item) => {
    const group = item.group || "main";
    acc[group] = acc[group] ?? [];
    acc[group]!.push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2 border-b border-sidebar-border px-3", collapsed && "justify-center px-0")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          {(data.config.branding.organisationShort ?? "OP").slice(0, 3).toUpperCase()}
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{data.config.branding.organisationName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{data.config.branding.tagline}</p>
          </div>
        ) : null}
      </div>

      <SidebarContent items={items} collapsed={collapsed} groups={groups} pathname={pathname} term={term} />

      <div className="mt-auto space-y-2 border-t border-sidebar-border p-3">
        {!collapsed ? (
          <Link
            href="/search"
            className="flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search everything</span>
            <kbd className="ml-auto rounded border border-border bg-card px-1 text-[10px]">⌘K</kbd>
          </Link>
        ) : null}

        {can("admin.access") ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                  pathname.startsWith("/admin") && "bg-sidebar-accent text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <Settings className="h-4 w-4" />
                {!collapsed ? <span>Administration</span> : null}
              </Link>
            </TooltipTrigger>
            {collapsed ? (
              <TooltipContent side="right">Administration</TooltipContent>
            ) : null}
          </Tooltip>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : (
            <>
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function SidebarContent({
  items,
  collapsed = false,
  pathname: currentPath,
  term,
  groups: providedGroups,
  onNavigate,
}: {
  items: NavItem[];
  collapsed?: boolean;
  pathname?: string;
  term?: (key: string, form?: "singular" | "plural", fallback?: string) => string;
  groups?: Record<string, NavItem[]>;
  onNavigate?: () => void;
}) {
  const hookPathname = usePathname();
  const pathname = currentPath ?? hookPathname;
  const session = useSession();
  const translate = term ?? session.term;
  const can = session.can ?? (() => true);

  const grouped =
    providedGroups ??
    items
      .filter((item) => item.enabled && (!item.permission || can(item.permission)))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .reduce<Record<string, NavItem[]>>((acc, item) => {
        const group = item.group || "main";
        acc[group] = acc[group] ?? [];
        acc[group]!.push(item);
        return acc;
      }, {});

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Primary">
      {Object.entries(grouped).map(([group, groupItems]) => (
        <div key={group} className="space-y-1">
          {!collapsed ? (
            <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {GROUP_LABELS[group] ?? group}
            </p>
          ) : (
            <Separator className="my-2" />
          )}
          {groupItems.map((item) => {
            const Icon = dynamicIcon(item.icon);
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)) || pathname.startsWith(`${item.href}?`);
            const label = item.moduleKey && translate ? translate(item.moduleKey, "plural", item.label) : item.label;

            const link = (
              <Link
                key={item.key}
                href={item.href ?? "#"}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                  active && "bg-sidebar-accent font-medium text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                {!collapsed ? <span className="truncate">{label}</span> : null}
              </Link>
            );

            if (!collapsed) return link;
            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}

      {Object.keys(grouped).length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">No navigation items are available for your role.</p>
      ) : null}
    </nav>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}

export { Badge, Button };
