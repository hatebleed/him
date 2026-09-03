"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Radar } from "lucide-react";

import { api } from "@/lib/api/client";
import { formatRelative } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";
import { OpsPanel } from "@/components/ops/frame";
import { SectorMap, type MapDistrict, type MapIncident, type MapUnit } from "@/components/ops/sector-map";
import { SignalDot, signalForStatus } from "@/components/ops/signal";
import { Elapsed } from "@/components/ops/live";
import { useSession } from "@/components/providers/session-provider";

type OpsWall = {
  districts: MapDistrict[];
  units: MapUnit[];
  incidents: MapIncident[];
  calls: Array<{
    id: string;
    reference: string;
    priority: string;
    status: string;
    description: string | null;
    location: string | null;
    receivedAt: string;
    assigned: Array<{ callsign: string }>;
  }>;
};

/** Live operations: the sector picture and the job queue. */
export default function NuiOpsPage() {
  const { statusLabel } = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["nui", "ops-wall"],
    queryFn: () => api.get<OpsWall>("/api/ops-wall"),
    refetchInterval: 15_000,
  });

  if (error) {
    return (
      <OpsPanel title="Operations unavailable">
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      </OpsPanel>
    );
  }

  return (
    <div className="space-y-3">
      <OpsPanel title="Sector view" subtitle="Units and open incidents" scanline>
        {isLoading || !data ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <SectorMap units={data.units} incidents={data.incidents} districts={data.districts} height={300} live />
        )}
      </OpsPanel>

      <OpsPanel title="Active calls" subtitle="Tap the map for detail in the full console" bodyClassName="p-2">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (data?.calls ?? []).length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No live calls.</p>
        ) : (
          <ul className="space-y-1">
            {(data?.calls ?? []).map((call) => (
              <li key={call.id} className="rounded-md px-2 py-2 hover:bg-secondary/50">
                <div className="flex items-center gap-2">
                  <SignalDot signal={signalForStatus(call.priority)} pulse={call.status === "PENDING"} />
                  <span className="data-mono text-[11px] text-muted-foreground">{call.reference}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{call.description ?? call.location}</span>
                  <Elapsed since={call.receivedAt} className="text-[11px]" />
                </div>
                <p className="mt-0.5 pl-4 text-xs text-muted-foreground">
                  {call.location ?? "No location"}
                  {call.assigned.length ? ` · ${call.assigned.map((unit) => unit.callsign).join(", ")}` : " · unassigned"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </OpsPanel>

      <OpsPanel title="Unit board" bodyClassName="p-2">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {(data?.units ?? []).map((unit) => (
              <li key={unit.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                <SignalDot signal={signalForStatus(unit.status)} pulse={["EN_ROUTE", "ON_SCENE"].includes(unit.status)} />
                <span className="data-mono w-14 text-sm font-medium">{unit.callsign}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{unit.location ?? "—"}</span>
                <span className="ops-label">{statusLabel("unit", unit.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </OpsPanel>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Radar className="h-3.5 w-3.5" /> Updated {formatRelative(new Date())}
      </p>
    </div>
  );
}
