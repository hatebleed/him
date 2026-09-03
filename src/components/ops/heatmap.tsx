"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { binByDayAndHour } from "./projection";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Temporal density map: day of week against hour of day.
 *
 * Shows when the area is actually busy, which a single trend line hides.
 * Intensity is relative to the busiest cell in the current selection.
 */
export function TemporalHeatmap({
  dates,
  matrix: matrixProp,
  max: maxProp,
  showLabels,
  className,
  cellHeight = 14,
}: {
  /** Raw timestamps to bin on the client; omit when the server sends `matrix`. */
  dates?: Array<string | Date | null>;
  /** Pre-binned 7x24 matrix (Monday first) from the analytics service. */
  matrix?: number[][];
  max?: number;
  showLabels?: boolean;
  className?: string;
  cellHeight?: number;
}) {
  const binned = React.useMemo(() => (dates ? binByDayAndHour(dates) : null), [dates]);
  const matrix = matrixProp ?? binned?.matrix ?? [];
  const max = maxProp ?? binned?.max ?? 0;
  const total = matrixProp ? matrix.reduce((sum, row) => sum + row.reduce((inner, cell) => inner + cell, 0), 0) : (binned?.total ?? 0);
  const [hovered, setHovered] = React.useState<{ day: number; hour: number; value: number } | null>(null);

  const intensity = (value: number) => {
    if (value === 0 || max === 0) return 0;
    // Square root scale: a few very busy hours should not flatten everything else.
    return Math.min(1, Math.sqrt(value / max));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showLabels === false ? null : (
        <div className="flex items-center justify-between">
          <p className="ops-label">Incident density · day × hour</p>
          <p className="data-mono text-[11px] text-muted-foreground">
            {total} record{total === 1 ? "" : "s"} · peak {max}
          </p>
        </div>
      )}

      <div className="overflow-x-auto ops-scroll">
        <div className="min-w-[520px]">
          <div className="mb-1 grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[2px]">
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="data-mono text-center text-[9px] text-muted-foreground">
                {hour % 3 === 0 ? hour : ""}
              </span>
            ))}
          </div>

          {matrix.map((row, day) => (
            <div key={day} className="mb-[2px] grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] items-center gap-[2px]">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{DAYS[day]}</span>
              {row.map((value, hour) => {
                const amount = intensity(value);
                const isHovered = hovered?.day === day && hovered?.hour === hour;
                return (
                  <button
                    key={hour}
                    type="button"
                    title={`${DAYS[day]} ${String(hour).padStart(2, "0")}:00 — ${value}`}
                    onMouseEnter={() => setHovered({ day, hour, value })}
                    onMouseLeave={() => setHovered(null)}
                    className={cn(
                      "rounded-[2px] border transition-transform",
                      isHovered ? "scale-125 border-[hsl(var(--hud-line))]" : "border-transparent",
                    )}
                    style={{
                      height: cellHeight,
                      background:
                        amount === 0
                          ? "hsl(var(--secondary) / 0.5)"
                          : `color-mix(in srgb, hsl(var(--primary)) ${Math.round(amount * 100)}%, hsl(var(--secondary) / 0.5))`,
                    }}
                    aria-label={`${DAYS[day]} ${hour}:00, ${value} incidents`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>00:00</span>
        <span className="flex items-center gap-1">
          less
          {[0, 0.25, 0.5, 0.75, 1].map((step) => (
            <span
              key={step}
              className="h-2.5 w-4 rounded-[2px]"
              style={{
                background:
                  step === 0
                    ? "hsl(var(--secondary) / 0.5)"
                    : `color-mix(in srgb, hsl(var(--primary)) ${Math.round(step * 100)}%, hsl(var(--secondary) / 0.5))`,
              }}
            />
          ))}
          more
        </span>
        <span>23:00</span>
      </div>
    </div>
  );
}
