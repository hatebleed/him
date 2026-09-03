"use client";

import * as React from "react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";

type AlertRow = {
  id: string;
  reference: string;
  type: string;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
};

export default function AlertsPage() {
  const { statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      { key: "reference", header: "Reference", sortable: true, width: "140px", cell: (row: AlertRow) => <span className="font-mono text-xs">{row.reference}</span> },
      {
        key: "subject",
        header: "Alert",
        sortable: true,
        cell: (row: AlertRow) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.subject}</p>
            <p className="truncate text-xs text-muted-foreground">{row.description ?? "—"}</p>
          </div>
        ),
      },
      { key: "type", header: "Type", cell: (row: AlertRow) => <span className="text-sm lowercase">{row.type.replace(/_/g, " ")}</span> },
      {
        key: "priority",
        header: "Priority",
        sortable: true,
        cell: (row: AlertRow) => (
          <Badge variant={row.priority === "CRITICAL" ? "destructive" : row.priority === "HIGH" ? "warning" : row.priority === "MEDIUM" ? "info" : "muted"}>
            {row.priority.toLowerCase()}
          </Badge>
        ),
      },
      { key: "status", header: "Status", sortable: true, cell: (row: AlertRow) => <Badge colour={statusColour("alert", row.status)}>{statusLabel("alert", row.status)}</Badge> },
      {
        key: "createdAt",
        header: "Created",
        sortable: true,
        align: "right" as const,
        cell: (row: AlertRow) => <span className="text-xs text-muted-foreground">{formatRelative(new Date(row.createdAt))}</span>,
      },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<AlertRow>
      resourceType="alert"
      endpoint="/api/alerts"
      title="Alerts"
      description="Operational alerts with acknowledgement and expiry."
      columns={columns}
      rowHref={(row) => `/alerts/${row.id}`}
      createHref="/alerts/new"
      createLabel="New alert"
      createPermission="alerts.create"
      searchPlaceholder="Search alerts…"
      emptyTitle="No alerts found"
      refreshInterval={60_000}
    />
  );
}
