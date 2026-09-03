"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";

/** Consistent page header: title, description, actions and optional tabs. */
export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-4 pb-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-3 pb-4">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

/** Small numeric/stat tile used across dashboards and detail pages. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/70 p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {trend ? <div className="mt-2">{trend}</div> : null}
    </div>
  );
}

/** Section wrapper with a heading, used on detail pages. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border/70 bg-card/70 shadow-card", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/** Key/value grid used for record summaries. */
export function DetailGrid({ items, columns = 2 }: { items: Array<{ label: string; value: React.ReactNode }>; columns?: 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2")}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 truncate text-sm">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
