"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Console panel: notched frame, sector grid, optional HUD brackets and a
 * header rail. Every panel in the operations console is built from this so the
 * surfaces stay consistent and re-branding still works through CSS variables.
 */
export function OpsPanel({
  title,
  subtitle,
  actions,
  className,
  bodyClassName,
  scanline = false,
  brackets = false,
  glow = false,
  dense = false,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  scanline?: boolean;
  brackets?: boolean;
  glow?: boolean;
  dense?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "ops-frame flex min-h-0 flex-col",
        brackets && "ops-brackets",
        glow && "ops-frame-glow",
        scanline && "ops-scanline",
        className,
      )}
    >
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2">
          <div className="min-w-0">
            <h2 className="ops-label truncate">{title}</h2>
            {subtitle ? <p className="truncate text-xs text-foreground/80">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-none items-center gap-1.5">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-h-0 flex-1", dense ? "p-0" : "p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small labelled figure, used inside console panels. */
export function OpsStat({
  label,
  value,
  hint,
  tone = "idle",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "idle" | "live" | "warn" | "hot";
  className?: string;
}) {
  const toneClass =
    tone === "live" ? "signal-text-live" : tone === "warn" ? "signal-text-warn" : tone === "hot" ? "signal-text-hot" : "signal-text-idle";
  return (
    <div className={cn("min-w-0", className)}>
      <p className="ops-label truncate">{label}</p>
      <p className={cn("data-mono mt-0.5 truncate text-lg font-semibold leading-tight", toneClass)}>{value}</p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Hairline divider with a lit leading edge. */
export function OpsDivider({ className }: { className?: string }) {
  return <div className={cn("ops-divider", className)} />;
}
