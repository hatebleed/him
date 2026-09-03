"use client";

import * as React from "react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";

type IncidentRow = {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  location: string | null;
  reportedAt: string | null;
  departmentName: string | null;
  assigned: string[];
};

export default function IncidentsPage() {
  const { term, statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      {
        key: "reference",
        header: "Reference",
        sortable: true,
        width: "140px",
        cell: (row: IncidentRow) => <span className="font-mono text-xs">{row.reference}</span>,
      },
      {
        key: "title",
        header: "Incident",
        sortable: true,
        cell: (row: IncidentRow) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="truncate text-xs text-muted-foreground">{row.location ?? "No location recorded"}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cell: (row: IncidentRow) => <Badge colour={statusColour("incident", row.status)}>{statusLabel("incident", row.status)}</Badge>,
      },
      {
        key: "priority",
        header: "Priority",
        sortable: true,
        cell: (row: IncidentRow) => (
          <Badge variant={row.priority === "CRITICAL" ? "destructive" : row.priority === "HIGH" ? "warning" : row.priority === "MEDIUM" ? "info" : "muted"}>
            {row.priority.toLowerCase()}
          </Badge>
        ),
      },
      {
        key: "assigned",
        header: "Assigned",
        secondary: true,
        cell: (row: IncidentRow) => (row.assigned.length ? <span className="text-xs">{row.assigned.join(", ")}</span> : <span className="text-muted-foreground">—</span>),
      },
      {
        key: "reportedAt",
        header: "Reported",
        sortable: true,
        align: "right" as const,
        cell: (row: IncidentRow) => <span className="text-xs text-muted-foreground">{row.reportedAt ? formatRelative(new Date(row.reportedAt)) : "—"}</span>,
      },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<IncidentRow>
      resourceType="incident"
      endpoint="/api/incidents"
      title={term("incident", "plural", "Incidents")}
      description="Create, assign and progress operational incidents."
      columns={columns}
      rowHref={(row) => `/incidents/${row.id}`}
      createHref="/incidents/new"
      createLabel={`New ${term("incident", "singular", "incident")}`}
      createPermission="incidents.create"
      searchPlaceholder="Search reference, title or location…"
      defaultSort="reportedAt"
      emptyTitle={`No ${term("incident", "plural", "incidents").toLowerCase()} found`}
    />
  );
}
