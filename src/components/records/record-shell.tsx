"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal, Paperclip, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge, Button } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { useSession } from "@/components/providers/session-provider";
import { AttachmentsPanel, AuditPanel, NotesPanel, RelationshipsPanel, TimelinePanel } from "./panels";

export type StatusOption = { key: string; label: string; colour: string };

/**
 * The reusable record detail system.
 *
 * Every record type renders through this component, so timelines, notes,
 * attachments, relationships and the audit trail behave identically
 * everywhere - and are implemented exactly once.
 */
export function RecordShell({
  recordType,
  recordId,
  reference,
  title,
  subtitle,
  status,
  statusOptions,
  onStatusChange,
  statusChanging,
  actions,
  overview,
  extraTabs = [],
  suggestions,
  backHref,
  priority,
  children,
}: {
  recordType: string;
  recordId: string;
  reference?: string | null;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: string | null;
  statusOptions?: StatusOption[];
  onStatusChange?: (status: string) => void;
  statusChanging?: boolean;
  actions?: React.ReactNode;
  overview: React.ReactNode;
  extraTabs?: Array<{ key: string; label: string; content: React.ReactNode; badge?: number }>;
  suggestions?: Array<{ type: string; id: string; label: string; reference?: string | null }>;
  backHref?: string;
  priority?: string | null;
  children?: React.ReactNode;
}) {
  const { can, statusColour } = useSession();
  const [tab, setTab] = React.useState("overview");
  const canAudit = can("admin.audit.view");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => (backHref ? (window.location.href = backHref) : window.history.back())}>
          <ArrowLeft />
          <span className="hidden sm:inline">Back</span>
        </Button>
        {reference ? <span className="font-mono text-xs text-muted-foreground">{reference}</span> : null}
      </div>

      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {status ? (
              <StatusBadge
                status={status}
                options={statusOptions}
                colour={statusColour(recordType, status)}
                onChange={onStatusChange}
                changing={statusChanging}
              />
            ) : null}
            {priority ? <Badge variant={priority === "CRITICAL" ? "destructive" : priority === "HIGH" ? "warning" : "muted"}>{priority.toLowerCase()}</Badge> : null}
          </div>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {extraTabs.map((extra) => (
            <TabsTrigger key={extra.key} value={extra.key}>
              {extra.label}
              {extra.badge ? <Badge variant="muted">{extra.badge}</Badge> : null}
            </TabsTrigger>
          ))}
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
          <TabsTrigger value="timeline">Activity</TabsTrigger>
          {canAudit ? <TabsTrigger value="audit">Audit</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="overview">
          {overview}
          {children}
        </TabsContent>

        {extraTabs.map((extra) => (
          <TabsContent key={extra.key} value={extra.key}>
            {extra.content}
          </TabsContent>
        ))}

        <TabsContent value="relationships">
          <RelationshipsPanel recordType={recordType} recordId={recordId} suggestions={suggestions} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesPanel recordType={recordType} recordId={recordId} />
        </TabsContent>
        <TabsContent value="attachments">
          <AttachmentsPanel recordType={recordType} recordId={recordId} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelinePanel recordType={recordType} recordId={recordId} />
        </TabsContent>
        {canAudit ? (
          <TabsContent value="audit">
            <AuditPanel resourceId={recordId} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function StatusBadge({
  status,
  options,
  colour,
  onChange,
  changing,
}: {
  status: string;
  options?: StatusOption[];
  colour: string;
  onChange?: (status: string) => void;
  changing?: boolean;
}) {
  if (!onChange || !options?.length) {
    return (
      <Badge colour={colour} className="capitalize">
        {options?.find((option) => option.key === status)?.label ?? status.replace(/_/g, " ")}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={changing}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-60"
          style={{ backgroundColor: `${colour}22`, borderColor: `${colour}44`, color: colour }}
        >
          {options.find((option) => option.key === status)?.label ?? status.replace(/_/g, " ")}
          <MoreHorizontal className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Change status</p>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.key}
            onSelect={() => (option.key !== status ? onChange(option.key) : undefined)}
            className={cn(option.key === status && "bg-secondary")}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.colour }} />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const HREFS: Record<string, string> = {
  person: "/people",
  vehicle: "/vehicles",
  incident: "/incidents",
  case: "/cases",
  report: "/reports",
  task: "/tasks",
  warrant: "/warrants",
  alert: "/alerts",
  bolo: "/bolos",
  evidence: "/evidence",
  call: "/dispatch",
  unit: "/units",
};

/** Header actions shared by detail pages (delete, extra menu items). */
export function RecordActions({
  canDelete,
  onDelete,
  deleting,
  extra,
}: {
  canDelete?: boolean;
  onDelete?: () => void;
  deleting?: boolean;
  extra?: Array<{ label: string; icon?: React.ReactNode; onSelect: () => void; destructive?: boolean }>;
}) {
  if (!canDelete && !extra?.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Record actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {extra?.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect} destructive={item.destructive}>
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
        {extra?.length && canDelete ? <DropdownMenuSeparator /> : null}
        {canDelete ? (
          <DropdownMenuItem destructive onSelect={() => onDelete?.()} disabled={deleting}>
            <Trash2 />
            {deleting ? "Deleting…" : "Delete record"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { Link, Paperclip };
