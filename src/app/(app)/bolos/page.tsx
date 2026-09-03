"use client";

import * as React from "react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";

type BoloRow = {
  id: string;
  reference: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  expiresAt: string | null;
  createdAt: string;
};

export default function BolosPage() {
  const { statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      { key: "reference", header: "Reference", sortable: true, width: "140px", cell: (row: BoloRow) => <span className="font-mono text-xs">{row.reference}</span> },
      {
        key: "subject",
        header: "Subject",
        sortable: true,
        cell: (row: BoloRow) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.subject}</p>
            <p className="truncate text-xs text-muted-foreground">{row.description ?? "—"}</p>
          </div>
        ),
      },
      { key: "status", header: "Status", sortable: true, cell: (row: BoloRow) => <Badge colour={statusColour("bolo", row.status)}>{statusLabel("bolo", row.status)}</Badge> },
      { key: "priority", header: "Priority", sortable: true, cell: (row: BoloRow) => <Badge variant={row.priority === "HIGH" ? "warning" : "info"}>{row.priority.toLowerCase()}</Badge> },
      {
        key: "createdAt",
        header: "Created",
        sortable: true,
        align: "right" as const,
        cell: (row: BoloRow) => <span className="text-xs text-muted-foreground">{formatRelative(new Date(row.createdAt))}</span>,
      },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<BoloRow>
      resourceType="bolo"
      endpoint="/api/bolos"
      title="BOLOs"
      description="Be-on-the-lookout notices for people and vehicles."
      columns={columns}
      rowHref={(row) => `/bolos/${row.id}`}
      createHref="/bolos/new"
      createLabel="New BOLO"
      createPermission="bolos.create"
      searchPlaceholder="Search BOLOs…"
      emptyTitle="No BOLOs found"
    />
  );
}
