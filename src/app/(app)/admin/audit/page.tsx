"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { Badge, Card, EmptyState, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { useDebounced } from "@/lib/hooks/use-list-query";
import { formatDateTime } from "@/lib/utils";

type AuditRow = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string | null;
  actorName: string | null;
  ip: string | null;
  createdAt: string;
};

/** Audit trail: append-only, searchable, and every search is itself audited. */
export default function AdminAuditPage() {
  const [search, setSearch] = React.useState("");
  const [action, setAction] = React.useState("");
  const debounced = useDebounced(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", debounced, action],
    queryFn: () => api.get<{ rows: AuditRow[]; total: number }>("/api/admin/audit", { search: debounced, action, pageSize: 60 }),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Audit trail" description="Every create, update, approval and configuration change is recorded." />

      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by summary, action or record id…"
          className="h-9 max-w-sm"
          aria-label="Search audit trail"
        />
        <Input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="Filter by action (e.g. report.approved)"
          className="h-9 max-w-xs"
          aria-label="Filter by action"
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No audit entries" description="Nothing matches the current filters." />
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{row.summary ?? row.action}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.actorName ?? "System"} · {row.resourceType}
                    {row.resourceId ? ` · ${row.resourceId.slice(0, 8)}` : ""}
                    {row.ip ? ` · ${row.ip}` : ""}
                  </p>
                </div>
                <Badge variant="muted" className="font-mono">
                  {row.action}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDateTime(new Date(row.createdAt))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
