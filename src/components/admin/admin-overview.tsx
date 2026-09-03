"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Database, FileText, Gauge, ScrollText, ShieldCheck, Upload, Users } from "lucide-react";

import { PageHeader, StatTile } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";

const SHORTCUTS = [
  { href: "/admin/fields", label: "Add a custom field", permission: "admin.fields.manage", icon: <Database /> },
  { href: "/admin/terminology", label: "Rename terminology", permission: "admin.terminology.manage", icon: <FileText /> },
  { href: "/admin/modules", label: "Enable or disable modules", permission: "admin.modules.manage", icon: <Activity /> },
  { href: "/admin/roles", label: "Edit role permissions", permission: "admin.roles.manage", icon: <ShieldCheck /> },
  { href: "/admin/users", label: "Manage users", permission: "admin.users.manage", icon: <Users /> },
  { href: "/admin/appearance", label: "Change the interface theme", permission: "admin.themes.manage", icon: <Gauge /> },
  { href: "/admin/import", label: "Import records", permission: "admin.import.execute", icon: <Upload /> },
  { href: "/admin/audit", label: "Review the audit trail", permission: "admin.audit.view", icon: <ScrollText /> },
];

export function AdminOverview({ stats, permissions }: { stats: Record<string, number>; permissions: string[] }) {
  const visible = SHORTCUTS.filter((item) => permissions.includes(item.permission));

  return (
    <div className="space-y-4">
      <PageHeader title="Administration" description="Configure the platform without writing code." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Users" value={stats.users ?? 0} icon={<Users />} />
        <StatTile label="People" value={stats.people ?? 0} icon={<Database />} />
        <StatTile label="Incidents" value={stats.incidents ?? 0} icon={<Activity />} />
        <StatTile label="Reports" value={stats.reports ?? 0} icon={<FileText />} />
        <StatTile label="Cases" value={stats.cases ?? 0} icon={<FileText />} />
        <StatTile label="Vehicles" value={stats.vehicles ?? 0} icon={<Database />} />
        <StatTile label="Tasks" value={stats.tasks ?? 0} icon={<Activity />} />
        <StatTile label="Audit entries" value={stats.audit ?? 0} icon={<ScrollText />} />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Common tasks</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-md border border-border/70 bg-secondary/20 px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-secondary/50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-muted-foreground"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
