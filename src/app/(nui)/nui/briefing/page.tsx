"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Gavel, ScanEye } from "lucide-react";

import { api } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/primitives";
import { OpsPanel, OpsStat } from "@/components/ops/frame";
import { SignalDot, signalForStatus } from "@/components/ops/signal";

type Briefing = {
  period: { hours: number };
  summary: { incidentsOpened: number; incidentsClosed: number; incidentsStillOpen: number; callsReceived: number; reportsSubmitted: number };
  openIncidents: Array<{ id: string; reference: string; title: string; priority: string; location: string | null }>;
  lookouts: Array<{ id: string; subject: string; priority: string; description: string | null }>;
  warrants: Array<{ id: string; type: string; reference: string; description: string | null }>;
  units: { total: number; available: number; committed: number };
};

/** The roll-call handover, generated from live records. */
export default function NuiBriefingPage() {
  const [hours, setHours] = React.useState(12);
  const { data, isLoading } = useQuery({
    queryKey: ["nui", "briefing", hours],
    queryFn: () => api.get<Briefing>("/api/briefing", { hours: String(hours) }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 rounded-md border border-border bg-card/60 p-0.5">
        {[8, 12, 24, 48].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setHours(value)}
            className={
              hours === value
                ? "rounded bg-secondary px-2.5 py-1 text-xs font-medium"
                : "rounded px-2.5 py-1 text-xs text-muted-foreground"
            }
          >
            {value}h
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OpsPanel dense>
              <OpsStat label="Opened" value={data.summary.incidentsOpened} hint={`${data.summary.incidentsClosed} closed`} tone="live" />
            </OpsPanel>
            <OpsPanel dense>
              <OpsStat label="Still open" value={data.summary.incidentsStillOpen} hint="Carrying over" tone="warn" />
            </OpsPanel>
            <OpsPanel dense>
              <OpsStat label="Calls" value={data.summary.callsReceived} hint="Received" tone="live" />
            </OpsPanel>
            <OpsPanel dense>
              <OpsStat label="Units" value={`${data.units.available}/${data.units.total}`} hint={`${data.units.committed} committed`} tone="idle" />
            </OpsPanel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <OpsPanel title="Still open" bodyClassName="p-2">
              {data.openIncidents.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing carried over.</p>
              ) : (
                <ul className="space-y-1">
                  {data.openIncidents.slice(0, 10).map((incident) => (
                    <li key={incident.id} className="flex items-start gap-2 rounded-md px-2 py-1.5">
                      <SignalDot signal={signalForStatus(incident.priority)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{incident.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {incident.reference} · {incident.location ?? "No location"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </OpsPanel>

            <div className="space-y-3">
              <OpsPanel title="Lookouts" bodyClassName="p-2">
                {data.lookouts.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">No active lookouts.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.lookouts.map((bolo) => (
                      <li key={bolo.id} className="flex items-start gap-2 rounded-md px-2 py-1">
                        <ScanEye className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{bolo.subject}</span>
                          {bolo.description ? <span className="line-clamp-2 block text-[11px] text-muted-foreground">{bolo.description}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </OpsPanel>

              <OpsPanel title="Warrants" bodyClassName="p-2">
                {data.warrants.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">No active warrants.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.warrants.map((warrant) => (
                      <li key={warrant.id} className="flex items-start gap-2 rounded-md px-2 py-1">
                        <Gavel className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{warrant.type}</span>
                          <span className="data-mono block text-[11px] text-muted-foreground">{warrant.reference}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </OpsPanel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
