"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type Signal = "live" | "warn" | "hot" | "idle";

/** Operational status -> signal colour. Unknown values read as idle. */
export function signalForStatus(status: string | null | undefined): Signal {
  const value = (status ?? "").toUpperCase();
  if (["AVAILABLE", "ACTIVE", "OPEN", "NEW", "IN_CUSTODY", "COMPLETED", "APPROVED"].includes(value)) return "live";
  if (["EN_ROUTE", "DISPATCHED", "PENDING", "IN_PROGRESS", "ASSIGNED", "SUBMITTED", "UNDER_REVIEW"].includes(value)) return "warn";
  if (["BUSY", "OUT_OF_SERVICE", "CRITICAL", "ESCALATED", "OVERDUE", "REJECTED"].includes(value)) return "hot";
  return "idle";
}

export function SignalDot({ signal = "idle", pulse = false, className }: { signal?: Signal; pulse?: boolean; className?: string }) {
  return <span className={cn("signal-dot", className)} data-signal={signal} data-pulse={pulse ? "true" : undefined} aria-hidden />;
}

/** Four-bar strength meter (radio / link quality style). */
export function SignalBars({ level, className }: { level: number; className?: string }) {
  const filled = Math.max(0, Math.min(4, Math.round(level)));
  return (
    <span className={cn("inline-flex items-end gap-[2px]", className)} aria-hidden>
      {[0, 1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            "w-[3px] rounded-sm",
            bar < filled ? "bg-[hsl(var(--signal-ok))]" : "bg-border",
          )}
          style={{ height: `${5 + bar * 3}px` }}
        />
      ))}
    </span>
  );
}

/** Compact status pill used across the console. */
export function StatusPill({
  status,
  signal,
  pulse,
  className,
}: {
  status: string;
  signal?: Signal;
  pulse?: boolean;
  className?: string;
}) {
  const tone = signal ?? signalForStatus(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-border/80 bg-card/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tone === "live" && "signal-text-live",
        tone === "warn" && "signal-text-warn",
        tone === "hot" && "signal-text-hot",
        tone === "idle" && "signal-text-idle",
        className,
      )}
    >
      <SignalDot signal={tone} pulse={pulse ?? tone === "hot"} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
