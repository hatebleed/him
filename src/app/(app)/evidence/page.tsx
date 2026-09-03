"use client";

import * as React from "react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { formatDate } from "@/lib/utils";

type EvidenceRow = {
  id: string;
  itemNumber: string;
  description: string;
  quantity: number;
  status: string;
  location: string | null;
  incidentReference: string | null;
  custodianName: string | null;
  collectedAt: string | null;
};

export default function EvidencePage() {
  const { statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      { key: "itemNumber", header: "Item", sortable: true, width: "140px", cell: (row: EvidenceRow) => <span className="font-mono text-xs">{row.itemNumber}</span> },
      { key: "description", header: "Description", sortable: true, cell: (row: EvidenceRow) => <span className="truncate font-medium">{row.description}</span> },
      { key: "status", header: "Status", sortable: true, cell: (row: EvidenceRow) => <Badge colour={statusColour("evidence", row.status)}>{statusLabel("evidence", row.status)}</Badge> },
      { key: "location", header: "Location", cell: (row: EvidenceRow) => <span className="truncate">{row.location ?? "—"}</span> },
      { key: "custodianName", header: "Custodian", secondary: true, cell: (row: EvidenceRow) => <span className="truncate">{row.custodianName ?? "—"}</span> },
      { key: "incidentReference", header: "Incident", secondary: true, cell: (row: EvidenceRow) => <span className="font-mono text-xs">{row.incidentReference ?? "—"}</span> },
      { key: "collectedAt", header: "Collected", sortable: true, align: "right" as const, cell: (row: EvidenceRow) => (row.collectedAt ? formatDate(new Date(row.collectedAt)) : "—") },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<EvidenceRow>
      resourceType="evidence"
      endpoint="/api/evidence"
      title="Evidence"
      description="Property and evidence with a full chain of custody."
      columns={columns}
      rowHref={(row) => `/evidence/${row.id}`}
      createHref="/evidence/new"
      createLabel="Book in item"
      createPermission="evidence.create"
      searchPlaceholder="Search item number, description or location…"
      emptyTitle="No evidence recorded"
    />
  );
}
