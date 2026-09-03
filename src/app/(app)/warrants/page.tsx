"use client";

import * as React from "react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { formatDate } from "@/lib/utils";

type WarrantRow = {
  id: string;
  reference: string;
  type: string;
  status: string;
  description: string | null;
  issuingAuthority: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  personReference: string;
  personName: string;
};

export default function WarrantsPage() {
  const { statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      { key: "reference", header: "Reference", sortable: true, width: "150px", cell: (row: WarrantRow) => <span className="font-mono text-xs">{row.reference}</span> },
      {
        key: "personName",
        header: "Person",
        cell: (row: WarrantRow) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.personName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.personReference}</p>
          </div>
        ),
      },
      { key: "type", header: "Type", cell: (row: WarrantRow) => <span className="text-sm lowercase">{row.type.replace(/_/g, " ")}</span> },
      { key: "status", header: "Status", sortable: true, cell: (row: WarrantRow) => <Badge colour={statusColour("warrant", row.status)}>{statusLabel("warrant", row.status)}</Badge> },
      { key: "issuingAuthority", header: "Issuing authority", secondary: true, cell: (row: WarrantRow) => <span className="truncate">{row.issuingAuthority ?? "—"}</span> },
      { key: "issuedAt", header: "Issued", sortable: true, cell: (row: WarrantRow) => (row.issuedAt ? formatDate(new Date(row.issuedAt)) : "—") },
      { key: "expiresAt", header: "Expires", cell: (row: WarrantRow) => (row.expiresAt ? formatDate(new Date(row.expiresAt)) : "—") },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<WarrantRow>
      resourceType="warrant"
      endpoint="/api/warrants"
      title="Warrants"
      description="Warrant records with issuing authority and expiry tracking."
      columns={columns}
      rowHref={(row) => `/warrants/${row.id}`}
      createHref="/warrants/new"
      createLabel="New warrant"
      createPermission="warrants.create"
      searchPlaceholder="Search warrants…"
      emptyTitle="No warrants found"
    />
  );
}
