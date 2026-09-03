"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Gavel, Printer, Radio, ScanEye, ShieldAlert } from "lucide-react";

import { api } from "@/lib/api/client";
import { cn, formatRelative } from "@/lib/utils";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page-header";
import { OpsPanel, OpsStat } from "@/components/ops/frame";
import { SignalDot, signalForStatus } from "@/components/ops/signal";
import { MiniBars } from "@/components/ops/gauges";
import { LiveClock } from "@/components/ops/live";
import { useSession } from "@/components/providers/session-provider";

type Briefing = {
  generatedAt: string;
  operator: { id: string; name: string; jobTitle: string | null; username: string };
  period: { hours: number; since: string; until: string };
  summary: {
    incidentsOpened: number;
    incidentsClosed: number;
    incidentsStillOpen: number;
    callsReceived: number;
    callsStillActive: number;
    reportsSubmitted: number;
    byPriority: Array<{ label: string; value: number }>;
  };
  openIncidents: Array<{ id: string; reference: string; title: string; priority: string; status: string; location: string | null; reportedAt: string | null }>;
  lookouts: Array<{ id: string; reference: string; subject: string; priority: string; description: string | null; expiresAt: string | null }>;
  warrants: Array<{ id: string; reference: string; type: string; description: string | null; personId: string | null }>;
  alerts: Array<{ id: string; reference: string; subject: string; priority: string; description: string | null }>;
  repeatInvolvement: Array<{ id: string; name: string; reference: string | null; riskLevel: string | null; incidents: number }>;
  units: {
    total: number;
    available: number;
    committed: number;
    offAir: number;
    roster: Array<{ id: string; callsign: string; name: string; status: string; location: string | null }>;
  };
  recentReports: Array<{ id: string; reference: string; title: string; status: string; submittedAt: string | null }>;
};

const PERIODS = [8, 12, 24, 48, 72];

/**
 * Shift briefing.
 *
 * The handover a supervisor reads out at roll call, generated from live
 * records: what happened, what is still open, who and what to look for, and
 * what resources are on duty. Nothing on this page is typed by hand.
 */
export default function BriefingPage() {
  const { statusLabel, term } = useSession();
  const [hours, setHours] = React.useState(12);

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["briefing", hours],
    queryFn: () => api.get<Briefing>("/api/briefing", { hours: String(hours) }),
    staleTime: 60_000,
  });

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Shift briefing" description="Roll-call handover" />
        <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="Briefing unavailable" description={(error as Error).message} />
      </div>
    );
  }


  return (
    <div className="space-y-4">
      <PageHeader
        title="Shift briefing"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <LiveClock className="text-xs" />
            <span className="text-muted-foreground">
              · last {hours}h · built {formatRelative(new Date(dataUpdatedAt || Date.now()))}
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-card/60 p-0.5">
              {PERIODS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHours(value)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs transition-colors",
                    hours === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value}h
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        }
      />

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OpsPanel dense>
              <OpsStat label={`${term("incident", "plural", "Incidents")} opened`} value={data.summary.incidentsOpened} hint={`${data.summary.incidentsClosed} closed in period`} tone="live" />
            </OpsPanel>
            <OpsPanel dense>
              <OpsStat label="Still open" value={data.summary.incidentsStillOpen} hint="Carrying into this shift" tone={data.summary.incidentsStillOpen > 0 ? "warn" : "idle"} />
            </OpsPanel>
            <OpsPanel dense>
              <OpsStat label="Calls received" value={data.summary.callsReceived} hint={`${data.summary.callsStillActive} still active`} tone="live" />
            </OpsPanel>
            <OpsPanel dense>
              <OpsStat label="Reports submitted" value={data.summary.reportsSubmitted} hint="Awaiting or in review" tone="idle" />
            </OpsPanel>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <OpsPanel
              className="xl:col-span-2"
              title="Still open"
              subtitle={`${term("incident", "plural", "Incidents").toLowerCase()} carrying into this shift`}
              bodyClassName="p-2"
            >
              {data.openIncidents.length === 0 ? (
                <EmptyState title="Nothing carried over" description="Every incident from the period is closed." />
              ) : (
                <ul className="divide-y divide-border/50">
                  {data.openIncidents.map((incident) => (
                    <li key={incident.id}>
                      <Link href={`/incidents/${incident.id}`} className="flex items-start gap-2 py-2 hover:text-primary">
                        <SignalDot signal={signalForStatus(incident.priority)} pulse={incident.priority === "CRITICAL"} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{incident.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {incident.reference} · {incident.location ?? "No location"}
                            {incident.reportedAt ? ` · ${formatRelative(new Date(incident.reportedAt))}` : ""}
                          </span>
                        </span>
                        <span className="ops-label">{statusLabel("incident", incident.status)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </OpsPanel>

            <OpsPanel title="Priority mix" subtitle="Incidents opened in the period" dense>
              {data.summary.byPriority.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No incidents in this period.</p>
              ) : (
                <MiniBars rows={data.summary.byPriority} />
              )}
            </OpsPanel>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <OpsPanel title="Lookouts" subtitle="Active BOLOs" bodyClassName="p-2">
              {data.lookouts.length === 0 ? (
                <EmptyState icon={<ScanEye className="h-5 w-5" />} title="No active lookouts" />
              ) : (
                <ul className="space-y-2">
                  {data.lookouts.map((bolo) => (
                    <li key={bolo.id} className="rounded-md px-2 py-1.5 hover:bg-secondary/50">
                      <div className="flex items-center gap-2">
                        <SignalDot signal={signalForStatus(bolo.priority)} />
                        <Link href={`/bolos/${bolo.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
                          {bolo.subject}
                        </Link>
                        <span className="data-mono text-[11px] text-muted-foreground">{bolo.reference}</span>
                      </div>
                      {bolo.description ? <p className="mt-0.5 line-clamp-2 pl-4 text-xs text-muted-foreground">{bolo.description}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </OpsPanel>

            <OpsPanel title="Warrants" subtitle="Outstanding" bodyClassName="p-2">
              {data.warrants.length === 0 ? (
                <EmptyState icon={<Gavel className="h-5 w-5" />} title="No active warrants" />
              ) : (
                <ul className="space-y-2">
                  {data.warrants.map((warrant) => (
                    <li key={warrant.id} className="rounded-md px-2 py-1.5 hover:bg-secondary/50">
                      <div className="flex items-center gap-2">
                        <SignalDot signal="hot" />
                        <Link href={`/warrants/${warrant.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
                          {warrant.type}
                        </Link>
                        <span className="data-mono text-[11px] text-muted-foreground">{warrant.reference}</span>
                      </div>
                      {warrant.description ? <p className="mt-0.5 line-clamp-2 pl-4 text-xs text-muted-foreground">{warrant.description}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </OpsPanel>

            <OpsPanel title="Alerts" subtitle="Currently active" bodyClassName="p-2">
              {data.alerts.length === 0 ? (
                <EmptyState title="No active alerts" />
              ) : (
                <ul className="space-y-2">
                  {data.alerts.map((alert) => (
                    <li key={alert.id} className="rounded-md px-2 py-1.5 hover:bg-secondary/50">
                      <div className="flex items-center gap-2">
                        <SignalDot signal={signalForStatus(alert.priority)} />
                        <Link href={`/alerts/${alert.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
                          {alert.subject}
                        </Link>
                        <span className="data-mono text-[11px] text-muted-foreground">{alert.reference}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </OpsPanel>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <OpsPanel title="Repeat involvement" subtitle="People in more than one incident this period" bodyClassName="p-2">
              {data.repeatInvolvement.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">No repeat involvement recorded.</p>
              ) : (
                <ul className="space-y-1">
                  {data.repeatInvolvement.map((person) => (
                    <li key={person.id}>
                      <Link href={`/people/${person.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/50">
                        <SignalDot signal={person.riskLevel === "HIGH" ? "hot" : person.riskLevel === "MEDIUM" ? "warn" : "idle"} />
                        <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
                        <span className="data-mono text-[11px] text-muted-foreground">
                          ×{person.incidents}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </OpsPanel>

            <OpsPanel title="On duty" subtitle={`${data.units.available} available of ${data.units.total}`} bodyClassName="p-2">
              {data.units.roster.length === 0 ? (
                <EmptyState icon={<Radio className="h-5 w-5" />} title="No units on duty" />
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto ops-scroll pr-1">
                  {data.units.roster.map((unit) => (
                    <li key={unit.id}>
                      <Link href={`/units/${unit.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/50">
                        <SignalDot signal={signalForStatus(unit.status)} pulse={["EN_ROUTE", "ON_SCENE"].includes(unit.status)} />
                        <span className="data-mono w-16 shrink-0">{unit.callsign}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{unit.location ?? unit.name}</span>
                        <span className="ops-label">{statusLabel("unit", unit.status)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </OpsPanel>

            <OpsPanel title="Reports submitted" subtitle="In the period" bodyClassName="p-2">
              {data.recentReports.length === 0 ? (
                <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No reports submitted" />
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto ops-scroll pr-1">
                  {data.recentReports.map((report) => (
                    <li key={report.id}>
                      <Link href={`/reports/${report.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/50">
                        <span className="min-w-0 flex-1 truncate">{report.title}</span>
                        <span className="ops-label">{statusLabel("report", report.status)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </OpsPanel>
          </div>

          <p className="text-xs text-muted-foreground">
            Prepared for {data.operator.name}
            {data.operator.jobTitle ? ` · ${data.operator.jobTitle}` : ""} · covering{" "}
            {new Date(data.period.since).toLocaleString()} to {new Date(data.period.until).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
