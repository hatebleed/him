"use client";

import * as React from "react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";

type VehicleRow = {
  id: string;
  reference: string;
  registration: string;
  make: string | null;
  model: string | null;
  year: number | null;
  colour: string | null;
  bodyType: string | null;
  status: string;
  departmentName: string | null;
  owners: Array<{ id: string; name: string; reference: string }>;
};

export default function VehiclesPage() {
  const { term, statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      {
        key: "registration",
        header: "Registration",
        sortable: true,
        cell: (row: VehicleRow) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.registration}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{row.reference}</p>
          </div>
        ),
      },
      {
        key: "make",
        header: "Vehicle",
        sortable: true,
        cell: (row: VehicleRow) => <span className="truncate">{[row.make, row.model, row.year].filter(Boolean).join(" ") || "—"}</span>,
      },
      { key: "colour", header: "Colour", secondary: true, cell: (row: VehicleRow) => row.colour ?? "—" },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cell: (row: VehicleRow) => <Badge colour={statusColour("vehicle", row.status)}>{statusLabel("vehicle", row.status)}</Badge>,
      },
      {
        key: "owners",
        header: "Owner",
        cell: (row: VehicleRow) =>
          row.owners.length ? (
            <a href={`/people/${row.owners[0]!.id}`} className="truncate text-sm hover:text-primary">
              {row.owners[0]!.name}
            </a>
          ) : (
            <span className="text-muted-foreground">Unlinked</span>
          ),
      },
      { key: "departmentName", header: "Department", secondary: true, cell: (row: VehicleRow) => <span className="truncate">{row.departmentName ?? "—"}</span> },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<VehicleRow>
      resourceType="vehicle"
      endpoint="/api/vehicles"
      title={term("vehicle", "plural", "Vehicles")}
      description={`Vehicle records, ownership and links to ${term("incident", "plural", "incidents").toLowerCase()}.`}
      columns={columns}
      rowHref={(row) => `/vehicles/${row.id}`}
      createHref="/vehicles/new"
      createLabel={`New ${term("vehicle", "singular", "vehicle")}`}
      createPermission="vehicles.create"
      searchPlaceholder="Search registration, make, model or VIN…"
      emptyTitle={`No ${term("vehicle", "plural", "vehicles").toLowerCase()} found`}
    />
  );
}
