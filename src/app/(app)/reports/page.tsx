"use client";

import * as React from "react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";

type ReportRow = {
  id: string;
  reference: string;
  title: string;
  status: string;
  currentVersion: number;
  authorName: string | null;
  incidentReference: string | null;
  submittedAt: string | null;
  createdAt: string;
};

export default function ReportsPage() {
  const { term, statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      {
        key: "reference",
        header: "Reference",
        sortable: true,
        width: "150px",
        cell: (row: ReportRow) => <span className="font-mono text-xs">{row.reference}</span>,
      },
      {
        key: "title",
        header: "Title",
        sortable: true,
        cell: (row: ReportRow) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="truncate text-xs text-muted-foreground">{row.incidentReference ? `Incident ${row.incidentReference}` : "No linked incident"}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cell: (row: ReportRow) => <Badge colour={statusColour("report", row.status)}>{statusLabel("report", row.status)}</Badge>,
      },
      { key: "currentVersion", header: "Version", align: "right" as const, cell: (row: ReportRow) => <span className="tabular text-xs">v{row.currentVersion}</span> },
      { key: "authorName", header: "Author", secondary: true, cell: (row: ReportRow) => <span className="truncate">{row.authorName ?? "—"}</span> },
      {
        key: "createdAt",
        header: "Created",
        sortable: true,
        align: "right" as const,
        cell: (row: ReportRow) => <span className="text-xs text-muted-foreground">{formatRelative(new Date(row.createdAt))}</span>,
      },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<ReportRow>
      resourceType="report"
      endpoint="/api/reports"
      title={term("report", "plural", "Reports")}
      description="Draft, submit, review and approve reports. Every save creates a new version."
      columns={columns}
      rowHref={(row) => `/reports/${row.id}`}
      createHref="/reports/new"
      createLabel={`New ${term("report", "singular", "report")}`}
      createPermission="reports.create"
      searchPlaceholder="Search reports…"
      emptyTitle={`No ${term("report", "plural", "reports").toLowerCase()} found`}
    />
  );
}
