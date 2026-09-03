"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Radio, RadioTower } from "lucide-react";

import { api } from "@/lib/api/client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui/primitives";
import { PageHeader, StatTile } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";

type DispatchPayload = {
  calls: Array<{
    id: string;
    reference: string;
    type: string;
    priority: string;
    status: string;
    description: string | null;
    location: string | null;
    receivedAt: string;
    units: Array<{ id: string; callsign: string; name: string; status: string }>;
  }>;
  units: Array<{ id: string; name: string; callsign: string; status: string; location: string | null; personnel: Array<{ id: string; name: string }>; activeCallId: string | null }>;
  provider: string;
};

/**
 * Live operations view.
 * Polled every 10 seconds (the realtime bridge invalidates on server events).
 */
export default function OperationsPage() {
  const { can, statusLabel, statusColour } = useSession();
  const queryClient = useQueryClient();

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["operations"],
    queryFn: () => api.get<DispatchPayload>("/api/dispatch"),
    refetchInterval: 10_000,
  });

  const units = data?.units ?? [];
  const calls = data?.calls ?? [];

  const counts = {
    available: units.filter((unit) => unit.status === "AVAILABLE").length,
    committed: units.filter((unit) => ["EN_ROUTE", "ON_SCENE", "BUSY"].includes(unit.status)).length,
    pending: calls.filter((call) => call.status === "PENDING").length,
    active: calls.length,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live operations"
        description={`Dispatch provider: ${data?.provider ?? "unknown"} · updated ${formatRelative(new Date(dataUpdatedAt || Date.now()))}`}
        actions={
          <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["operations"] })}>
            Refresh now
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active calls" value={counts.active} icon={<RadioTower />} />
        <StatTile label="Awaiting dispatch" value={counts.pending} icon={<AlertTriangle />} hint="Calls not yet assigned" />
        <StatTile label="Units available" value={counts.available} icon={<Radio />} />
        <StatTile label="Units committed" value={counts.committed} icon={<Radio />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active calls</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : error ? (
              <p className="text-sm text-destructive">{(error as Error).message}</p>
            ) : calls.length === 0 ? (
              <EmptyState icon={<RadioTower className="h-5 w-5" />} title="No active calls" description="New calls appear here the moment they are received." />
            ) : (
              <ul className="divide-y divide-border/60">
                {calls.map((call) => (
                  <li key={call.id} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{call.reference}</span>
                      <Badge variant={call.priority === "CRITICAL" ? "destructive" : call.priority === "HIGH" ? "warning" : "info"}>
                        {call.priority.toLowerCase()}
                      </Badge>
                      <Badge colour={statusColour("call", call.status)}>{statusLabel("call", call.status)}</Badge>
                      <span className="ml-auto text-xs text-muted-foreground">{formatRelative(new Date(call.receivedAt))}</span>
                    </div>
                    <p className="mt-1 text-sm">{call.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {call.location ?? "No location"} · {call.units.map((unit) => unit.callsign).join(", ") || "No units assigned"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unit board</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ul className="space-y-2">
                {units.slice(0, 12).map((unit) => (
                  <li key={unit.id} className="flex items-center gap-2">
                    <a href={`/units/${unit.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
                      {unit.callsign}
                    </a>
                    <Badge colour={statusColour("unit", unit.status)}>{statusLabel("unit", unit.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!can("dispatch.view") ? (
        <p className="text-xs text-muted-foreground">You have read-only visibility of the operations board.</p>
      ) : null}
    </div>
  );
}
