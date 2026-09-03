"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileText, Radio, RadioTower, ScanEye } from "lucide-react";

import { api } from "@/lib/api/client";
import { formatRelative } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";
import { OpsPanel, OpsStat } from "@/components/ops/frame";
import { RadialGauge } from "@/components/ops/gauges";
import { SignalDot, signalForStatus } from "@/components/ops/signal";
import { useSession } from "@/components/providers/session-provider";

type OpsWall = {
  metrics: {
    unitTotal: number;
    unitAvailable: number;
    unitCommitted: number;
    readiness: number;
    openIncidents: number;
    criticalIncidents: number;
    activeCalls: number;
    pendingCalls: number;
  };
  calls: Array<{ id: string; reference: string; priority: string; description: string | null; location: string | null; receivedAt: string; status: string }>;
};

type Bolo = { id: string; subject: string; priority: string; description: string | null; reference: string | null };

/** The tablet home: what is happening right now, and what to look for. */
export default function NuiHomePage() {
  const { term } = useSession();
  const wall = useQuery({
    queryKey: ["nui", "ops-wall"],
    queryFn: () => api.get<OpsWall>("/api/ops-wall"),
    refetchInterval: 15_000,
  });
  const lookouts = useQuery({
    queryKey: ["nui", "bolos"],
    queryFn: () => api.get<{ rows: Bolo[] }>("/api/bolos", { pageSize: 5, status: "ACTIVE" }),
    refetchInterval: 60_000,
  });

  const metrics = wall.data?.metrics;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <OpsPanel dense className="flex items-center gap-3">
          <RadialGauge value={metrics?.readiness ?? 0} label="Ready" suffix="%" size={70} />
          <OpsStat label="Units" value={`${metrics?.unitAvailable ?? 0}/${metrics?.unitTotal ?? 0}`} hint={`${metrics?.unitCommitted ?? 0} committed`} tone="live" />
        </OpsPanel>
        <OpsPanel dense>
          <OpsStat label="Active calls" value={metrics?.activeCalls ?? 0} hint={`${metrics?.pendingCalls ?? 0} awaiting`} tone={(metrics?.pendingCalls ?? 0) > 0 ? "warn" : "idle"} />
        </OpsPanel>
        <OpsPanel dense>
          <OpsStat
            label={term("incident", "plural", "Incidents")}
            value={metrics?.openIncidents ?? 0}
            hint={`${metrics?.criticalIncidents ?? 0} critical`}
            tone={(metrics?.criticalIncidents ?? 0) > 0 ? "hot" : "live"}
          />
        </OpsPanel>
        <OpsPanel dense className="flex items-center justify-center">
          <Link href="/nui/briefing" className="text-center">
            <FileText className="mx-auto h-5 w-5 text-muted-foreground" />
            <span className="mt-1 block text-xs font-medium">Shift briefing</span>
          </Link>
        </OpsPanel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <OpsPanel title="Priority calls" subtitle="Newest first" bodyClassName="p-2">
          {wall.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (wall.data?.calls ?? []).length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No live calls.</p>
          ) : (
            <ul className="space-y-1">
              {(wall.data?.calls ?? []).slice(0, 6).map((call) => (
                <li key={call.id} className="rounded-md px-2 py-1.5 hover:bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <SignalDot signal={signalForStatus(call.priority)} pulse={call.status === "PENDING"} />
                    <span className="data-mono text-[11px] text-muted-foreground">{call.reference}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{call.description ?? call.location}</span>
                    <span className="text-[11px] text-muted-foreground">{formatRelative(new Date(call.receivedAt))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OpsPanel>

        <OpsPanel title="Lookouts" subtitle="Active BOLOs" bodyClassName="p-2">
          {lookouts.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (lookouts.data?.rows ?? []).length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing to look for.</p>
          ) : (
            <ul className="space-y-2">
              {(lookouts.data?.rows ?? []).map((bolo) => (
                <li key={bolo.id} className="rounded-md px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <ScanEye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{bolo.subject}</span>
                    <span className="data-mono text-[11px] text-muted-foreground">{bolo.reference}</span>
                  </div>
                  {bolo.description ? <p className="mt-0.5 line-clamp-2 pl-5 text-xs text-muted-foreground">{bolo.description}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </OpsPanel>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <RadioTower className="h-3.5 w-3.5" /> {term("call", "plural", "calls")} update every 15s
        </span>
        <span className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" /> press <kbd className="rounded border border-border px-1">Esc</kbd> to close
        </span>
        {wall.error ? (
          <span className="flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {(wall.error as Error).message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
