"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { useListQuery } from "@/lib/hooks/use-list-query";
import { useSession } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";

type UnitRow = {
  id: string;
  name: string;
  callsign: string;
  status: string;
  statusNote: string | null;
  statusUpdatedAt: string | null;
  location: string | null;
  departmentName: string | null;
  vehicleRegistration: string | null;
  personnel: Array<{ id: string; name: string; role: string }>;
};

const STATUS_OPTIONS = ["AVAILABLE", "EN_ROUTE", "ON_SCENE", "BUSY", "OUT_OF_SERVICE", "OFF_DUTY"];

export default function UnitsPage() {
  const { can, statusLabel, statusColour } = useSession();
  const queryClient = useQueryClient();
  const { query, setQuery, apiParams } = useListQuery({ pageSize: 25, sort: "callsign", dir: "asc" });

  const { data, isFetching, error } = useQuery({
    queryKey: ["units", apiParams],
    queryFn: () => api.get<{ rows: UnitRow[]; total: number; page: number; pageSize: number; pageCount: number }>("/api/units", apiParams),
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
  });

  const setStatus = useMutation({
    mutationFn: (payload: { id: string; status: string }) => api.post(`/api/units/${payload.id}/status`, { status: payload.status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Unit status updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const columns = React.useMemo<Array<DataTableColumn<UnitRow>>>(
    () => [
      {
        key: "callsign",
        header: "Callsign",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-semibold">{row.callsign}</p>
            <p className="truncate text-xs text-muted-foreground">{row.name}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cell: (row) =>
          can("units.status") ? (
            <Select value={row.status} onValueChange={(value) => setStatus.mutate({ id: row.id, status: value })}>
              <SelectTrigger className="h-8 w-40 text-xs" aria-label={`Status for ${row.callsign}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {statusLabel("unit", option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge colour={statusColour("unit", row.status)}>{statusLabel("unit", row.status)}</Badge>
          ),
      },
      { key: "location", header: "Location", cell: (row) => <span className="truncate">{row.location ?? "—"}</span> },
      { key: "vehicleRegistration", header: "Vehicle", secondary: true, cell: (row) => <span className="truncate">{row.vehicleRegistration ?? "—"}</span> },
      {
        key: "personnel",
        header: "Personnel",
        secondary: true,
        cell: (row) => (
          <span className="truncate text-xs">{row.personnel.map((member) => member.name).join(", ") || "—"}</span>
        ),
      },
      {
        key: "statusUpdatedAt",
        header: "Updated",
        align: "right",
        cell: (row) => <span className="text-xs text-muted-foreground">{row.statusUpdatedAt ? formatRelative(new Date(row.statusUpdatedAt)) : "—"}</span>,
      },
    ],
    [can, setStatus, statusColour, statusLabel],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Units"
        description="Live unit roster. Status changes are broadcast to dashboards and dispatch."
        actions={
          can("admin.units.manage") ? (
            <Button size="sm" onClick={() => toast.message("Unit administration", { description: "Use the Administration section to create and configure units." })}>
              Manage units
            </Button>
          ) : null
        }
      />

      <DataTable<UnitRow>
        rows={data?.rows ?? []}
        meta={data ? { total: data.total, page: data.page, pageSize: data.pageSize, pageCount: data.pageCount } : undefined}
        columns={columns}
        query={query}
        onQueryChange={setQuery}
        loading={isFetching}
        error={error as Error | null}
        resourceType="unit"
        searchPlaceholder="Search callsign, name or location…"
        rowHref={(row) => `/units/${row.id}`}
        emptyTitle="No units configured"
      />
    </div>
  );
}
