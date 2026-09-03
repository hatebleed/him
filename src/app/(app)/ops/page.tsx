"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar, RefreshCw, RadioTower, ShieldAlert } from "lucide-react";

import { api } from "@/lib/api/client";
import { cn, formatRelative } from "@/lib/utils";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page-header";
import { OpsPanel, OpsStat } from "@/components/ops/frame";
import { SignalDot, StatusPill, signalForStatus } from "@/components/ops/signal";
import { MiniBars, RadialGauge } from "@/components/ops/gauges";
import { SectorMap, type MapDistrict, type MapIncident, type MapUnit } from "@/components/ops/sector-map";
import { TemporalHeatmap } from "@/components/ops/heatmap";
import { Elapsed, EventTicker, LiveClock } from "@/components/ops/live";
import { useSession } from "@/components/providers/session-provider";

type OpsWall = {
  generatedAt: string;
  districts: MapDistrict[];
  units: MapUnit[];
  incidents: MapIncident[];
  calls: Array<{
    id: string;
    reference: string;
    type: string;
    priority: string;
    status: string;
    description: string | null;
    location: string | null;
    receivedAt: string;
    dispatchedAt: string | null;
    assigned: Array<{ callsign: string; status: string }>;
  }>;
  events: Array<{ id: string; at: string; label: string; detail: string | null }>;
  metrics: {
    unitTotal: number;
    unitAvailable: number;
    unitCommitted: number;
    unitOffAir: number;
    readiness: number;
    openIncidents: number;
    criticalIncidents: number;
    highIncidents: number;
    activeCalls: number;
    pendingCalls: number;
    avgDispatchMinutes: number | null;
  };
};

/**
 * Operations wall.
 *
 * A single console view: where everything is, what is outstanding, and what
 * just changed. Polled every 15 seconds; the realtime bridge invalidates the
 * same query key the instant the server publishes an event.
 */
export default function OpsWallPage() {
  const { can, statusLabel, term } = useSession();
  const queryClient = useQueryClient();

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["ops-wall"],
    queryFn: () => api.get<OpsWall>("/api/ops-wall"),
    refetchInterval: 15_000,
  });

  const units = data?.units ?? [];
  const incidents = data?.incidents ?? [];
  const calls = data?.calls ?? [];
  const metrics = data?.metrics;

  const statusCounts = [...units.reduce((counts, unit) => counts.set(unit.status, (counts.get(unit.status) ?? 0) + 1), new Map<string, number>()).entries()]
    .map(([label, value]) => ({ label: statusLabel("unit", label), value }))
    .sort((a, b) => b.value - a.value);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Operations wall" description="Live sector view" />
        <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="Operations wall unavailable" description={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Operations wall"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <LiveClock className="text-xs" />
            <span className="text-muted-foreground">· refreshed {formatRelative(new Date(dataUpdatedAt || Date.now()))}</span>
          </span>
        }
        actions={
          <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["ops-wall"] })}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OpsPanel dense className="flex items-center gap-3">
          <RadialGauge value={metrics?.readiness ?? 0} label="Readiness" suffix="%" size={78} />
          <div className="min-w-0">
            <OpsStat
              label="Units available"
              value={`${metrics?.unitAvailable ?? 0}/${metrics?.unitTotal ?? 0}`}
              hint={`${metrics?.unitCommitted ?? 0} committed · ${metrics?.unitOffAir ?? 0} off air`}
              tone={(metrics?.readiness ?? 0) >= 60 ? "live" : "warn"}
            />
          </div>
        </OpsPanel>

        <OpsPanel dense>
          <OpsStat
            label={term("incident", "plural", "Incidents") + " open"}
            value={metrics?.openIncidents ?? 0}
            hint={`${metrics?.criticalIncidents ?? 0} critical · ${metrics?.highIncidents ?? 0} high`}
            tone={(metrics?.criticalIncidents ?? 0) > 0 ? "hot" : "live"}
          />
        </OpsPanel>

        <OpsPanel dense>
          <OpsStat
            label="Active calls"
            value={metrics?.activeCalls ?? 0}
            hint={`${metrics?.pendingCalls ?? 0} awaiting dispatch`}
            tone={(metrics?.pendingCalls ?? 0) > 0 ? "warn" : "idle"}
          />
        </OpsPanel>

        <OpsPanel dense>
          <OpsStat
            label="Mean dispatch"
            value={metrics?.avgDispatchMinutes === null || metrics?.avgDispatchMinutes === undefined ? "—" : `${metrics.avgDispatchMinutes}m`}
            hint="Received to dispatched"
            tone="idle"
          />
        </OpsPanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <OpsPanel
          className="xl:col-span-2"
          title="Sector view"
          subtitle="District grid with live unit and incident placement"
          scanline
          actions={<SignalDot signal="live" pulse />}
        >
          {isLoading ? (
            <Skeleton className="h-[420px] w-full" />
          ) : (
            <SectorMap units={units} incidents={incidents} districts={data?.districts ?? []} height={420} live />
          )}
        </OpsPanel>

        <OpsPanel title="Event feed" subtitle="Latest recorded activity" bodyClassName="p-2">
          {isLoading ? <Skeleton className="h-[420px] w-full" /> : <EventTicker events={data?.events ?? []} limit={30} className="max-h-[420px]" />}
        </OpsPanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <OpsPanel title="Unit roster" subtitle={can("units.view") ? "Status as reported by dispatch" : "Read-only visibility"} bodyClassName="p-2">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : units.length === 0 ? (
            <EmptyState icon={<Radar className="h-5 w-5" />} title="No active units" />
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto ops-scroll pr-1">
              {units.map((unit) => (
                <li key={unit.id}>
                  <Link
                    href={`/units/${unit.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary/60"
                  >
                    <SignalDot signal={signalForStatus(unit.status)} pulse={["EN_ROUTE", "ON_SCENE"].includes(unit.status)} />
                    <span className="data-mono w-16 shrink-0 font-medium">{unit.callsign}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{unit.location ?? unit.name}</span>
                    <StatusPill status={statusLabel("unit", unit.status)} signal={signalForStatus(unit.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </OpsPanel>

        <OpsPanel title="Active calls" subtitle="Oldest first" bodyClassName="p-2">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : calls.length === 0 ? (
            <EmptyState icon={<RadioTower className="h-5 w-5" />} title="No active calls" />
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto ops-scroll pr-1">
              {calls.map((call) => (
                <li key={call.id} className="rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/60">
                  <div className="flex items-center gap-2">
                    <SignalDot signal={signalForStatus(call.priority)} pulse={call.status === "PENDING"} />
                    <Link href={`/dispatch?call=${call.id}`} className="data-mono text-xs text-muted-foreground hover:text-primary">
                      {call.reference}
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-sm">{call.description ?? call.type}</span>
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

        <div className="space-y-3">
          <OpsPanel title="Unit status mix" dense>
            {isLoading ? <Skeleton className="h-24 w-full" /> : <MiniBars rows={statusCounts} />}
          </OpsPanel>
          <OpsPanel title="Open incidents" subtitle="Plotted on the sector view" bodyClassName="p-2">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : incidents.length === 0 ? (
              <EmptyState title="Nothing open" />
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto ops-scroll pr-1">
                {incidents.slice(0, 20).map((incident) => (
                  <li key={incident.id}>
                    <Link href={`/incidents/${incident.id}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary/60">
                      <SignalDot signal={signalForStatus(incident.priority)} pulse={incident.priority === "CRITICAL"} />
                      <span className="min-w-0 flex-1 truncate">{incident.title}</span>
                      <span className="data-mono text-[11px] text-muted-foreground">{incident.reference}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </OpsPanel>
        </div>
      </div>

      <OpsPanel
        title="Demand profile"
        subtitle={`When open ${term("incident", "plural", "incidents").toLowerCase()} were reported, by weekday and hour`}
        className={cn("ops-frame")}
      >
        {isLoading ? <Skeleton className="h-40 w-full" /> : <TemporalHeatmap dates={incidents.map((incident) => incident.occurredAt)} />}
      </OpsPanel>
    </div>
  );
}
