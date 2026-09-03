"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useSession } from "./session-provider";

/**
 * Realtime bridge.
 *
 * Subscribes to the server-sent event stream and invalidates the affected
 * queries (or raises a toast) when the server publishes an event. Swapping
 * the transport is a server-side change - this component is unchanged.
 */
export function RealtimeProvider() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!user) return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      source = new EventSource("/api/events/stream");

      const invalidate = (...keys: string[][]) => {
        keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      };

      source.addEventListener("notification.created", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as { title?: string };
        invalidate(["notifications"], ["session", "shell"]);
        if (payload?.title) toast.message(payload.title, { description: "Open the notification centre to view it." });
      });

      source.addEventListener("message.created", () => invalidate(["channel"], ["communications"]));
      source.addEventListener("unit.status.changed", () => invalidate(["units"], ["dispatch"], ["operations"], ["ops-wall"], ["briefing"]));
      source.addEventListener("call.created", () => invalidate(["calls"], ["dispatch"], ["operations"], ["ops-wall"], ["briefing"]));
      source.addEventListener("call.updated", () => invalidate(["calls"], ["dispatch"], ["ops-wall"], ["briefing"]));
      source.addEventListener("incident.updated", () => invalidate(["incidents"], ["analytics"], ["ops-wall"], ["briefing"], ["link-graph"]));
      source.addEventListener("record.updated", () => invalidate(["ops-wall"], ["link-graph"], ["briefing"]));

      source.onerror = () => {
        source?.close();
        if (!disposed) retryTimer = setTimeout(connect, 5_000);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [user, queryClient]);

  return null;
}
