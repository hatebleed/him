"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Section } from "@/components/layout/page-header";

/** Two-column detail layout shared by record pages. */
export function DetailLayout({ main, sidebar, className }: { main: React.ReactNode; sidebar?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-3 lg:grid-cols-3", className)}>
      <div className="space-y-3 lg:col-span-2">{main}</div>
      {sidebar ? <div className="space-y-3">{sidebar}</div> : null}
    </div>
  );
}

export type RelatedItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  badge?: React.ReactNode;
  href: string;
};

/** Compact list of related records shown in a detail sidebar. */
export function RelatedList({
  title,
  items,
  empty = "Nothing linked yet.",
  action,
  limit = 8,
}: {
  title: string;
  items: RelatedItem[];
  empty?: string;
  action?: React.ReactNode;
  limit?: number;
}) {
  const visible = items.slice(0, limit);
  return (
    <Section title={title} actions={action}>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id}>
              <a href={item.href} className="flex items-center gap-2 text-sm transition-colors hover:text-primary">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  {item.subtitle ? <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span> : null}
                </span>
                {item.badge}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
