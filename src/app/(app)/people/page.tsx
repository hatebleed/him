"use client";

import * as React from "react";
import {} from "lucide-react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { formatDate } from "@/lib/utils";

type PersonRow = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  status: string;
  riskLevel: string | null;
  departmentName: string | null;
  dateOfBirth: string | null;
  createdAt: string;
  vehicleCount: number;
  incidentCount: number;
};

export default function PeoplePage() {
  const { term, statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      {
        key: "lastName",
        header: "Name",
        sortable: true,
        cell: (row: PersonRow) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.firstName} {row.lastName}
            </p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{row.reference}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cell: (row: PersonRow) => <Badge colour={statusColour("person", row.status)}>{statusLabel("person", row.status)}</Badge>,
      },
      {
        key: "riskLevel",
        header: "Risk",
        cell: (row: PersonRow) =>
          row.riskLevel ? (
            <Badge variant={row.riskLevel === "HIGH" ? "destructive" : row.riskLevel === "MEDIUM" ? "warning" : "muted"}>
              {row.riskLevel.toLowerCase()}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { key: "departmentName", header: "Department", cell: (row: PersonRow) => <span className="truncate">{row.departmentName ?? "—"}</span> },
      { key: "dateOfBirth", header: "Date of birth", secondary: true, cell: (row: PersonRow) => (row.dateOfBirth ? formatDate(new Date(row.dateOfBirth)) : "—") },
      {
        key: "incidentCount",
        header: "Linked",
        align: "right" as const,
        cell: (row: PersonRow) => (
          <span className="tabular text-xs text-muted-foreground">
            {row.incidentCount} inc · {row.vehicleCount} veh
          </span>
        ),
      },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<PersonRow>
      resourceType="person"
      endpoint="/api/people"
      title={term("person", "plural", "People")}
      description={`Search and manage ${term("person", "plural", "people").toLowerCase()} records, identifiers, contacts and links.`}
      columns={columns}
      rowHref={(row) => `/people/${row.id}`}
      createHref="/people/new"
      createLabel={`New ${term("person", "singular", "person")}`}
      createPermission="people.create"
      searchPlaceholder="Search by name, reference or alias…"
      defaultSort="createdAt"
      emptyTitle={`No ${term("person", "plural", "people").toLowerCase()} found`}
      emptyDescription={`Create the first ${term("person", "singular", "person").toLowerCase()} record or adjust your filters.`}
    />
  );
}

