"use client";

import * as React from "react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";

type CaseRow = {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  leadName: string | null;
  departmentName: string | null;
  openedAt: string | null;
  incidentCount: number;
};

export default function CasesPage() {
  const { term, statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      {
        key: "reference",
        header: "Reference",
        sortable: true,
        width: "150px",
        cell: (row: CaseRow) => <span className="font-mono text-xs">{row.reference}</span>,
      },
      { key: "title", header: "Case", sortable: true, cell: (row: CaseRow) => <span className="truncate font-medium">{row.title}</span> },
      { key: "status", header: "Status", sortable: true, cell: (row: CaseRow) => <Badge colour={statusColour("case", row.status)}>{statusLabel("case", row.status)}</Badge> },
      {
        key: "priority",
        header: "Priority",
        sortable: true,
        cell: (row: CaseRow) => <Badge variant={row.priority === "HIGH" ? "warning" : row.priority === "MEDIUM" ? "info" : "muted"}>{row.priority.toLowerCase()}</Badge>,
      },
      { key: "leadName", header: "Lead", cell: (row: CaseRow) => <span className="truncate">{row.leadName ?? "—"}</span> },
      { key: "incidentCount", header: "Incidents", align: "right" as const, cell: (row: CaseRow) => <span className="tabular text-xs">{row.incidentCount}</span> },
      {
        key: "openedAt",
        header: "Opened",
        sortable: true,
        align: "right" as const,
        cell: (row: CaseRow) => <span className="text-xs text-muted-foreground">{row.openedAt ? formatRelative(new Date(row.openedAt)) : "—"}</span>,
      },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<CaseRow>
      resourceType="case"
      endpoint="/api/cases"
      title={term("case", "plural", "Cases")}
      description="Group incidents and reports into managed cases with review outcomes."
      columns={columns}
      rowHref={(row) => `/cases/${row.id}`}
      createHref="/cases/new"
      createLabel={`New ${term("case", "singular", "case")}`}
      createPermission="cases.create"
      searchPlaceholder="Search cases…"
      emptyTitle={`No ${term("case", "plural", "cases").toLowerCase()} found`}
    />
  );
}
