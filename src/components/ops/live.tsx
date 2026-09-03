"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { SignalDot, type Signal } from "./signal";

/** Live clock that only ticks on the client (no hydration mismatch). */
export function LiveClock({ className, showSeconds = true }: { className?: string; showSeconds?: boolean }) {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return <span className={cn("data-mono text-muted-foreground", className)}>--:--:--</span>;

  const time = now.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: showSeconds ? "2-digit" : undefined });
  const date = now.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className={cn("text-right", className)}>
      <p className="data-mono text-2xl font-semibold leading-none tracking-tight">{time}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{date}</p>
    </div>
  );
}

/** Elapsed time since a timestamp, updated every 30 seconds. */
export function Elapsed({ since, className, prefix }: { since: string | null | undefined; className?: string; prefix?: string }) {
  const [, force] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => force((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!since) return <span className={cn("data-mono text-muted-foreground", className)}>—</span>;

  const then = new Date(since).getTime();
  if (Number.isNaN(then)) return <span className={cn("data-mono text-muted-foreground", className)}>—</span>;

  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  const label = minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${Math.floor(minutes / 1440)}d`;

  return (
    <span className={cn("data-mono", className)} title={new Date(since).toLocaleString()}>
      {prefix ? `${prefix} ` : ""}
      {label}
    </span>
  );
}

export type TickerEvent = { id: string; at: string; label: string; detail?: string | null; signal?: Signal };

/**
 * Live event ticker.
 * Newest events slide in at the top; older entries fade out down the list.
 */
export function EventTicker({ events, className, limit = 14 }: { events: TickerEvent[]; className?: string; limit?: number }) {
  const visible = events.slice(0, limit);

  if (visible.length === 0) {
    return (
      <p className={cn("px-1 py-6 text-center text-xs text-muted-foreground", className)}>
        No activity recorded yet.
      </p>
    );
  }

  return (
    <ul className={cn("ops-scroll max-h-full space-y-1 overflow-y-auto pr-1", className)}>
      {visible.map((event, index) => (
        <li
          key={event.id}
          className={cn(
            "ops-rise flex items-start gap-2 rounded-sm border border-border/60 bg-card/50 px-2 py-1.5",
            index === 0 && "border-[hsl(var(--hud-line)/0.4)]",
          )}
          style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
        >
          <SignalDot signal={event.signal ?? "idle"} pulse={index === 0} className="mt-1" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium leading-tight">{event.label}</p>
            {event.detail ? <p className="truncate text-[11px] text-muted-foreground">{event.detail}</p> : null}
          </div>
          <Elapsed since={event.at} className="flex-none text-[10px] text-muted-foreground" />
        </li>
      ))}
    </ul>
  );
}
