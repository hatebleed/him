"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Counts up to a value when it changes (respects reduced-motion). */
export function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const [display, setDisplay] = React.useState(value);

  React.useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }

    const from = display;
    const delta = value - from;
    if (delta === 0) return;

    let frame = 0;
    const start = performance.now();
    const duration = 520;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + delta * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `display` is intentionally excluded: it is the animation's own output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const safe = Number.isFinite(display) ? display : 0;
  return (
    <span className={cn("data-mono", className)}>{safe.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>
  );
}

/** Radial gauge: arc, centre figure and a threshold-driven colour. */
export function RadialGauge({
  value,
  max = 100,
  label,
  suffix = "%",
  size = 132,
  thresholds = { warn: 60, hot: 35 },
  invert = false,
}: {
  value: number;
  max?: number;
  label: string;
  suffix?: string;
  size?: number;
  /** Value at/below which the gauge turns amber (hot = worse). */
  thresholds?: { warn: number; hot: number };
  /** When true, higher is worse. */
  invert?: boolean;
}) {
  const safeMax = max || 1;
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.75; // three-quarter dial
  const filled = arc * ratio;

  const healthy = invert ? value <= thresholds.hot : value >= thresholds.warn;
  const warning = !healthy && (invert ? value <= thresholds.warn : value >= thresholds.hot);
  const colour = healthy ? "hsl(var(--signal-ok))" : warning ? "hsl(var(--signal-warn))" : "hsl(var(--signal-hot))";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${Math.round(value)}${suffix}`}>
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={stroke}
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1), stroke 400ms" }}
          />
        </g>
        <text x="50%" y="48%" textAnchor="middle" className="data-mono" fontSize={size * 0.24} fontWeight={700} fill="hsl(var(--foreground))">
          {Math.round(value)}
          <tspan fontSize={size * 0.12} fill="hsl(var(--muted-foreground))">
            {suffix}
          </tspan>
        </text>
        <text x="50%" y="66%" textAnchor="middle" fontSize={size * 0.085} fill="hsl(var(--muted-foreground))" letterSpacing="0.08em">
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

/** Sparkline with area fill. */
export function Sparkline({
  values,
  width = 120,
  height = 34,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const gradientId = React.useId();
  if (values.length === 0) return <div className={cn("h-[34px] rounded-sm border border-dashed border-border", className)} />;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const line = `M ${points.join(" L ")}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={(values.length - 1) * step}
        cy={height - ((values[values.length - 1]! - min) / span) * (height - 6) - 3}
        r={2.5}
        fill="hsl(var(--primary))"
      />
    </svg>
  );
}

/** Horizontal bar distribution with labels. */
export function MiniBars({
  rows,
  className,
  format,
}: {
  rows: Array<{ label: string; value: number }>;
  className?: string;
  format?: (value: number) => string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className={cn("space-y-1.5", className)}>
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-[11px] capitalize text-muted-foreground">{row.label.replace(/_/g, " ").toLowerCase()}</span>
          <span className="h-2 overflow-hidden rounded-sm bg-secondary/70">
            <span
              className="block h-full rounded-sm bg-[hsl(var(--primary))] transition-[width] duration-700"
              style={{ width: `${Math.round((row.value / max) * 100)}%` }}
            />
          </span>
          <span className="data-mono text-[11px] text-foreground">{format ? format(row.value) : row.value}</span>
        </li>
      ))}
    </ul>
  );
}
