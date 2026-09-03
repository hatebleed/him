"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Maps an icon name (stored as configuration data) to the component.
 * Unknown names fall back to a neutral icon instead of crashing a page.
 */
const registry = Icons as unknown as Record<string, LucideIcon>;

export function dynamicIcon(name: string | null | undefined, fallback = "CircleDot"): LucideIcon {
  if (!name) return registry[fallback] ?? registry.CircleDot!;
  const pascal = name
    .split(/[-_\s]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return registry[pascal] ?? registry[name] ?? registry[fallback] ?? registry.CircleDot!;
}

export type { LucideIcon };

export function RecordIcon({ type, className }: { type: string; className?: string }) {
  const map: Record<string, string> = {
    person: "User",
    vehicle: "Car",
    incident: "FileText",
    case: "Briefcase",
    report: "FileCheck",
    task: "CheckSquare",
    warrant: "Gavel",
    alert: "BellRing",
    bolo: "ScanEye",
    evidence: "Boxes",
    call: "RadioTower",
    unit: "Radio",
    user: "UserCog",
    channel: "MessageSquare",
  };
  const Icon = dynamicIcon(map[type] ?? "CircleDot");
  return <Icon className={className} />;
}
