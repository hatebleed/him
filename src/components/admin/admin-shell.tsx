"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Boxes,
  Building2,
  Database,
  FileText,
  Gauge,
  Gavel,
  LayoutDashboard,
  ListChecks,
  Palette,
  Radio,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Type,
  Upload,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

type AdminNavItem = { key: string; href: string; label: string; icon: React.ReactNode; permission?: string; group: string };

const NAV: AdminNavItem[] = [
  { key: "overview", href: "/admin", label: "Overview", icon: <LayoutDashboard />, group: "General" },
  { key: "users", href: "/admin/users", label: "Users", icon: <Users />, permission: "admin.users.manage", group: "Access" },
  { key: "roles", href: "/admin/roles", label: "Roles & permissions", icon: <ShieldCheck />, permission: "admin.roles.manage", group: "Access" },
  { key: "departments", href: "/admin/departments", label: "Departments", icon: <Building2 />, permission: "admin.departments.manage", group: "Access" },
  { key: "units", href: "/admin/units", label: "Units", icon: <Radio />, permission: "admin.units.manage", group: "Access" },
  { key: "modules", href: "/admin/modules", label: "Modules", icon: <Boxes />, permission: "admin.modules.manage", group: "Structure" },
  { key: "navigation", href: "/admin/navigation", label: "Navigation", icon: <ListChecks />, permission: "admin.navigation.manage", group: "Structure" },
  { key: "fields", href: "/admin/fields", label: "Custom fields", icon: <Database />, permission: "admin.fields.manage", group: "Structure" },
  { key: "forms", href: "/admin/forms", label: "Forms", icon: <FileText />, permission: "admin.forms.manage", group: "Structure" },
  { key: "workflows", href: "/admin/workflows", label: "Workflows", icon: <SlidersHorizontal />, permission: "admin.workflows.manage", group: "Structure" },
  { key: "statuses", href: "/admin/statuses", label: "Statuses", icon: <Tags />, permission: "admin.statuses.manage", group: "Structure" },
  { key: "categories", href: "/admin/categories", label: "Categories", icon: <Tags />, permission: "admin.categories.manage", group: "Structure" },
  { key: "terminology", href: "/admin/terminology", label: "Terminology", icon: <Type />, permission: "admin.terminology.manage", group: "Presentation" },
  { key: "branding", href: "/admin/branding", label: "Branding", icon: <Palette />, permission: "admin.branding.manage", group: "Presentation" },
  { key: "appearance", href: "/admin/appearance", label: "Appearance", icon: <Gauge />, permission: "admin.themes.manage", group: "Presentation" },
  { key: "notifications", href: "/admin/notifications", label: "Notifications", icon: <Bell />, permission: "admin.notifications.manage", group: "System" },
  { key: "settings", href: "/admin/settings", label: "Settings", icon: <Settings2 />, permission: "admin.settings.manage", group: "System" },
  { key: "import", href: "/admin/import", label: "Import & export", icon: <Upload />, permission: "admin.import.execute", group: "System" },
  { key: "audit", href: "/admin/audit", label: "Audit trail", icon: <ScrollText />, permission: "admin.audit.view", group: "System" },
];

export function AdminShell({
  children,
  permissions,
  userName,
}: {
  children: React.ReactNode;
  permissions: string[];
  userName: string;
}) {
  const pathname = usePathname();
  const allowed = NAV.filter((item) => !item.permission || permissions.includes(item.permission));
  const groups = allowed.reduce<Record<string, AdminNavItem[]>>((acc, item) => {
    acc[item.group] = acc[item.group] ?? [];
    acc[item.group]!.push(item);
    return acc;
  }, {});

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-16 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
        <nav className="space-y-4 rounded-lg border border-border/70 bg-card/60 p-3" aria-label="Administration">
          <div>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{userName}</p>
            <p className="px-2 text-[11px] text-muted-foreground">{permissions.length} permissions</p>
          </div>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="space-y-0.5">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">{group}</p>
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5",
                      active && "bg-secondary font-medium text-foreground",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export { Gavel };
