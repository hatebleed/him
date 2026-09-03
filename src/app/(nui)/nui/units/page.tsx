"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Radio } from "lucide-react";

import { api, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";
import { OpsPanel } from "@/components/ops/frame";
import { SignalDot, signalForStatus } from "@/components/ops/signal";
import { postToHost } from "@/components/nui/bridge";
import { useSession } from "@/components/providers/session-provider";

type UnitRow = { id: string; callsign: string; name: string; status: string; location: string | null };

const STATUSES = ["AVAILABLE", "EN_ROUTE", "ON_SCENE", "BUSY", "OUT_OF_SERVICE"];
const MY_CALLSIGN_KEY = "nui:callsign";

/**
 * Unit board.
 *
 * Officers pick their callsign once and can then work their own status from
 * inside the car. The status write goes through the normal API, so it is
 * authorised by the linked account's permissions, not by the game client.
 */
export default function NuiUnitsPage() {
  const { statusLabel, can } = useSession();
  const queryClient = useQueryClient();
  const [myCallsign, setMyCallsign] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMyCallsign(window.localStorage.getItem(MY_CALLSIGN_KEY));
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["nui", "units"],
    queryFn: () => api.get<{ rows: UnitRow[] }>("/api/units", { pageSize: 50 }),
    refetchInterval: 20_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.post(`/api/units/${id}/status`, { status }),
    onSuccess: (_result, variables) => {
      postToHost({ type: "mdt:notify", level: "success", message: `Status set to ${variables.status.toLowerCase().replace(/_/g, " ")}` });
      void queryClient.invalidateQueries({ queryKey: ["nui", "units"] });
    },
    onError: (mutationError) => {
      postToHost({ type: "mdt:notify", level: "error", message: errorMessage(mutationError) });
    },
  });

  const rows = data?.rows ?? [];
  const mine = rows.find((unit) => unit.callsign === myCallsign) ?? null;

  const choose = (callsign: string) => {
    setMyCallsign(callsign);
    window.localStorage.setItem(MY_CALLSIGN_KEY, callsign);
  };

  if (error) {
    return (
      <OpsPanel title="Units unavailable">
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      </OpsPanel>
    );
  }

  return (
    <div className="space-y-3">
      {mine ? (
        <OpsPanel title={`Unit ${mine.callsign}`} subtitle="Set your status" scanline>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                disabled={!can("units.status") || statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: mine.id, status })}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50",
                  mine.status === status ? "border-primary/50 bg-secondary" : "border-border hover:bg-secondary/60",
                )}
              >
                <SignalDot signal={signalForStatus(status)} />
                <span className="truncate">{statusLabel("unit", status)}</span>
              </button>
            ))}
          </div>
          {!can("units.status") ? (
            <p className="mt-2 text-[11px] text-muted-foreground">Your account can view the board but not change unit status.</p>
          ) : null}
        </OpsPanel>
      ) : null}

      <OpsPanel title="Unit board" subtitle={myCallsign ? `Working as ${myCallsign}` : "Select your callsign"} bodyClassName="p-2">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No units on the roster.</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {rows.map((unit) => (
              <li key={unit.id}>
                <button
                  type="button"
                  onClick={() => choose(unit.callsign)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
                    unit.callsign === myCallsign ? "bg-secondary" : "hover:bg-secondary/50",
                  )}
                >
                  <SignalDot signal={signalForStatus(unit.status)} pulse={["EN_ROUTE", "ON_SCENE"].includes(unit.status)} />
                  <span className="data-mono w-14 text-sm font-medium">{unit.callsign}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{unit.location ?? unit.name}</span>
                  <span className="ops-label">{statusLabel("unit", unit.status)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </OpsPanel>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Radio className="h-3.5 w-3.5" /> The callsign you pick is remembered on this device.
      </p>
    </div>
  );
}
