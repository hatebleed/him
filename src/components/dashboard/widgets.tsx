"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Boxes,
  CalendarClock,
  CheckSquare,
  FileCheck,
  FileText,
  Plus,
  Radio,
  TrendingUp,
  Users,
} from "lucide-react";

import { cn, formatRelative } from "@/lib/utils";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, LinkButton, Skeleton } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { Section } from "@/components/layout/page-header";

export type WidgetType = string;

export type MetricValue = { key: string; label: string; value: number; hint?: string };

export type DashboardData = {
  metrics: Record<string, MetricValue>;
  trend: Array<{ label: string; value: number }>;
  priority: Array<{ label: string; value: number }>;
  activity: Array<{ id: string; recordType: string; recordId: string; type: string; message: string; actorName: string | null; occurredAt: string }>;
};

export type WidgetInstance = {
  id: string;
  type: string;
  title: string | null;
  size: string;
  visible: boolean;
  sortOrder: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

const METRIC_DEFINITIONS: Record<string, { key: string; label: string; icon: React.ReactNode; href?: string }> = {
  metric_activeIncidents: { key: "activeIncidents", label: "Active incidents", icon: <FileText />, href: "/incidents" },
  metric_openTasks: { key: "openTasks", label: "Open tasks", icon: <CheckSquare />, href: "/tasks" },
  metric_activeUnits: { key: "activeUnits", label: "Available units", icon: <Radio />, href: "/units" },
  metric_pendingReports: { key: "pendingReports", label: "Reports pending", icon: <FileCheck />, href: "/reports?status=SUBMITTED" },
  metric_overdueTasks: { key: "overdueTasks", label: "Overdue tasks", icon: <CalendarClock />, href: "/tasks" },
  metric_evidenceInCustody: { key: "evidenceInCustody", label: "Evidence in custody", icon: <Boxes />, href: "/evidence" },
  metric_activeAlerts: { key: "activeAlerts", label: "Active alerts", icon: <BellRing />, href: "/alerts" },
  metric_incidentsThisWeek: { key: "incidentsThisWeek", label: "New incidents (7d)", icon: <TrendingUp />, href: "/incidents" },
};

/**
 * Widget renderer.
 *
 * Widgets are data: the dashboard stores widget rows and this registry
 * renders them. Adding a widget type here immediately makes it available in
 * the widget catalogue without touching the dashboard page.
 */
export function DashboardWidget({
  widget,
  data,
  loading,
  onRemove,
}: {
  widget: WidgetInstance;
  data: DashboardData | undefined;
  loading: boolean;
  onRemove?: () => void;
}) {
  const { term } = useSession();

  if (widget.type.startsWith("metric.")) return <MetricWidget widget={widget} data={data} loading={loading} onRemove={onRemove} />;

  if (widget.type === "chart.incidentTrend") {
    return (
      <WidgetFrame title={widget.title ?? "Incident trend"} onRemove={onRemove} className={spanClass(widget)}>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <BarChart data={data?.trend ?? []} />
        )}
      </WidgetFrame>
    );
  }

  if (widget.type === "chart.incidentPriority") {
    return (
      <WidgetFrame title={widget.title ?? "Incidents by priority"} onRemove={onRemove} className={spanClass(widget)}>
        {loading ? <Skeleton className="h-40 w-full" /> : <PriorityBars data={data?.priority ?? []} />}
      </WidgetFrame>
    );
  }

  if (widget.type === "list.recentRecords" || widget.type === "list.activeIncidents") {
    const rows = (data as unknown as { recent?: Array<Record<string, unknown>> })?.recent ?? [];
    return (
      <WidgetFrame title={widget.title ?? term("incident", "plural", "Incidents")} onRemove={onRemove} className={spanClass(widget)} href="/incidents">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing to show" description="Records you create appear here." />
        ) : (
          <RecordList rows={rows as Array<{ id: string; reference?: string; title?: string; status?: string; priority?: string }>} basePath="/incidents" />
        )}
      </WidgetFrame>
    );
  }

  if (widget.type === "list.unitStatus") {
    return (
      <WidgetFrame title={widget.title ?? "Unit status"} onRemove={onRemove} className={spanClass(widget)} href="/units">
        <UnitStatusList />
      </WidgetFrame>
    );
  }

  if (widget.type === "list.myTasks") {
    return (
      <WidgetFrame title={widget.title ?? "My tasks"} onRemove={onRemove} className={spanClass(widget)} href="/tasks">
        <MyTaskList />
      </WidgetFrame>
    );
  }

  if (widget.type === "list.notifications") {
    return (
      <WidgetFrame title={widget.title ?? "Notifications"} onRemove={onRemove} className={spanClass(widget)} href="/notifications">
        <NotificationWidget />
      </WidgetFrame>
    );
  }

  if (widget.type === "list.alerts") {
    return (
      <WidgetFrame title={widget.title ?? "Active alerts"} onRemove={onRemove} className={spanClass(widget)} href="/alerts">
        <AlertWidget />
      </WidgetFrame>
    );
  }

  if (widget.type === "list.pendingReports") {
    return (
      <WidgetFrame title={widget.title ?? "Pending reports"} onRemove={onRemove} className={spanClass(widget)} href="/reports?status=SUBMITTED">
        <PendingReportsWidget />
      </WidgetFrame>
    );
  }

  if (widget.type === "quickActions") {
    return (
      <WidgetFrame title={widget.title ?? "Quick actions"} onRemove={onRemove} className={spanClass(widget)}>
        <QuickActions />
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={widget.title ?? widget.type} onRemove={onRemove} className={spanClass(widget)}>
      <p className="text-sm text-muted-foreground">This widget type is not available.</p>
    </WidgetFrame>
  );
}

function MetricWidget({
  widget,
  data,
  loading,
  onRemove,
}: {
  widget: WidgetInstance;
  data: DashboardData | undefined;
  loading: boolean;
  onRemove?: () => void;
}) {
  const definition = METRIC_DEFINITIONS[widget.type];
  const metric = definition ? data?.metrics?.[definition.key] : undefined;
  const body = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{definition?.label ?? widget.title}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-16" />
        ) : (
          <p className="mt-1.5 text-3xl font-semibold tabular tracking-tight">{metric?.value ?? 0}</p>
        )}
        {metric?.hint ? <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p> : null}
      </div>
      {definition?.icon ? (
        <span className="rounded-md border border-border bg-secondary/50 p-2 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{definition.icon}</span>
      ) : null}
    </div>
  );

  if (definition?.href) {
    return (
      <Link href={definition.href} className={cn("block rounded-lg border border-border/70 bg-card/70 p-3.5 shadow-card transition-colors hover:border-primary/40 hover:bg-card", "col-span-1")}>
        {body}
      </Link>
    );
  }
  return <WidgetFrame onRemove={onRemove} className="col-span-1">{body}</WidgetFrame>;
}

/** Quick actions respects the caller's permissions; hooks stay unconditional. */
function QuickActions() {
  const { can, term } = useSession();
  const actions = [
    { label: `New ${term("person", "singular", "person")}`, href: "/people/new", permission: "people.create", icon: <Users /> },
    { label: `New ${term("vehicle", "singular", "vehicle")}`, href: "/vehicles/new", permission: "vehicles.create", icon: <Activity /> },
    { label: `New ${term("incident", "singular", "incident")}`, href: "/incidents/new", permission: "incidents.create", icon: <FileText /> },
    { label: `New ${term("report", "singular", "report")}`, href: "/reports/new", permission: "reports.create", icon: <FileCheck /> },
  ].filter((action) => can(action.permission));

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {actions.map((action) => (
        <LinkButton key={action.href} href={action.href} variant="outline" size="sm" className="justify-start">
          <Plus className="h-3.5 w-3.5" />
          {action.label}
        </LinkButton>
      ))}
    </div>
  );
}

function WidgetFrame({
  title,
  children,
  onRemove,
  className,
  href,
}: {
  title?: string;
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
  href?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      {title ? (
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-1">
            {href ? (
              <Link href={href} className="text-xs text-muted-foreground transition-colors hover:text-primary">
                View all
              </Link>
            ) : null}
            {onRemove ? (
              <button type="button" onClick={onRemove} className="ml-2 text-xs text-muted-foreground hover:text-destructive" aria-label="Remove widget">
                Remove
              </button>
            ) : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}

function spanClass(widget: WidgetInstance) {
  const w = Math.min(4, Math.max(1, widget.w));
  return w >= 4 ? "xl:col-span-4 lg:col-span-2" : w === 3 ? "xl:col-span-3 lg:col-span-2" : w === 2 ? "xl:col-span-2 lg:col-span-2" : "";
}

function RecordList({
  rows,
  basePath,
}: {
  rows: Array<{ id: string; reference?: string; title?: string; status?: string; priority?: string }>;
  basePath: string;
}) {
  const { statusLabel, statusColour } = useSession();
  const type = basePath.replace("/", "").replace(/s$/, "");
  return (
    <ul className="divide-y divide-border/50">
      {rows.slice(0, 6).map((row) => (
        <li key={row.id}>
          <Link href={`${basePath}/${row.id}`} className="flex items-center gap-3 py-2 transition-colors hover:text-primary">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{row.title ?? row.reference}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.reference}</span>
            </span>
            {row.priority ? <Badge variant={row.priority === "CRITICAL" ? "destructive" : row.priority === "HIGH" ? "warning" : "muted"}>{String(row.priority).toLowerCase()}</Badge> : null}
            {row.status ? <Badge colour={statusColour(type, row.status)}>{statusLabel(type, row.status)}</Badge> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data for this period.</p>
      ) : (
        data.map((item) => (
          <div key={item.label} className="group flex flex-1 flex-col items-center gap-1.5">
            <div className="relative flex w-full flex-1 items-end justify-center">
              <div
                className="w-full rounded-t bg-primary/70 transition-all group-hover:bg-primary"
                style={{ height: `${Math.round((item.value / max) * 100)}%` }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{item.label.slice(5)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function PriorityBars({ data }: { data: Array<{ label: string; value: number }> }) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  const colours: Record<string, string> = { LOW: "#64748b", MEDIUM: "#38bdf8", HIGH: "#f59e0b", CRITICAL: "#ef4444" };
  return (
    <div className="space-y-2.5">
      {data.length === 0 ? <p className="text-sm text-muted-foreground">No open incidents.</p> : null}
      {data.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{item.label.toLowerCase()}</span>
            <span className="tabular text-muted-foreground">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.round((item.value / total) * 100)}%`, backgroundColor: colours[item.label] ?? "#38bdf8" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function UnitStatusList() {
  const { data, isLoading } = useQueryUnits();
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const rows = data ?? [];
  if (!rows.length) return <EmptyState title="No units" description="Units appear once they are configured." />;
  return (
    <ul className="divide-y divide-border/50">
      {rows.slice(0, 6).map((unit) => (
        <li key={unit.id} className="flex items-center gap-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{unit.callsign}</span>
            <span className="block truncate text-xs text-muted-foreground">{unit.name}</span>
          </span>
          <Badge variant={unit.status === "AVAILABLE" ? "success" : unit.status === "OFF_DUTY" ? "muted" : "warning"}>
            {unit.status.replace(/_/g, " ").toLowerCase()}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function MyTaskList() {
  const { data, isLoading } = useQueryTasks();
  const { statusLabel, statusColour } = useSession();
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const rows = data ?? [];
  if (!rows.length) return <EmptyState title="No open tasks" description="Tasks assigned to you appear here." />;
  return (
    <ul className="divide-y divide-border/50">
      {rows.map((task) => (
        <li key={task.id}>
          <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 py-2 hover:text-primary">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{task.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {task.dueAt ? `Due ${formatRelative(new Date(task.dueAt))}` : "No due date"}
              </span>
            </span>
            <Badge colour={statusColour("task", task.status)}>{statusLabel("task", task.status)}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NotificationWidget() {
  const { data } = useSession();
  const rows = (data?.notifications.recent ?? []) as Array<{ id: string; title: string; message: string | null; createdAt: string }>;
  if (!rows.length) return <EmptyState title="No notifications" description="You are all caught up." />;
  return (
    <ul className="divide-y divide-border/50">
      {rows.slice(0, 6).map((notification) => (
        <li key={notification.id} className="py-2">
          <p className="truncate text-sm font-medium">{notification.title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
        </li>
      ))}
    </ul>
  );
}

function AlertWidget() {
  const { data, isLoading } = useQueryAlerts();
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const rows = (data?.rows ?? []).slice(0, 6);
  if (!rows.length) return <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="No active alerts" />;
  return (
    <ul className="divide-y divide-border/50">
      {rows.map((alert: { id: string; subject: string; priority: string; reference?: string | null }) => (
        <li key={alert.id}>
          <Link href={`/alerts/${alert.id}`} className="flex items-center gap-3 py-2 hover:text-primary">
            <span className="min-w-0 flex-1 truncate text-sm">{alert.subject}</span>
            <Badge variant={alert.priority === "CRITICAL" ? "destructive" : alert.priority === "HIGH" ? "warning" : "muted"}>
              {alert.priority.toLowerCase()}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PendingReportsWidget() {
  const { data, isLoading } = useQueryReports();
  const { statusLabel, statusColour } = useSession();
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const rows = data?.rows ?? [];
  if (!rows.length) return <EmptyState title="Nothing pending" description="No reports are waiting for review." />;
  return (
    <ul className="divide-y divide-border/50">
      {rows.map((report) => (
        <li key={report.id}>
          <Link href={`/reports/${report.id}`} className="flex items-center gap-3 py-2 hover:text-primary">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{report.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{report.reference}</span>
            </span>
            <Badge colour={statusColour("report", report.status)}>{statusLabel("report", report.status)}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Local queries kept in the widget module so the dashboard page stays small.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

function useQueryUnits() {
  return useQuery({ queryKey: ["dashboard", "units"], queryFn: () => api.get<Array<{ id: string; callsign: string; name: string; status: string }>>("/api/units", { pageSize: 8 }), select: (data) => (data as unknown as { rows: Array<{ id: string; callsign: string; name: string; status: string }> }).rows ?? [] });
}
function useQueryTasks() {
  return useQuery({
    queryKey: ["dashboard", "tasks"],
    queryFn: () => api.get<{ rows: Array<{ id: string; title: string; status: string; dueAt: string | null }> }>("/api/tasks", { pageSize: 6, assignee: "me" }),
    select: (data) => data.rows ?? [],
  });
}
function useQueryAlerts() {
  return useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: () => api.get<{ rows: Array<{ id: string; subject: string; priority: string; reference: string | null }> }>("/api/alerts", { pageSize: 6, status: "ACTIVE" }),
  });
}
function useQueryReports() {
  return useQuery({
    queryKey: ["dashboard", "reports"],
    queryFn: () => api.get<{ rows: Array<{ id: string; reference: string; title: string; status: string }> }>("/api/reports", { pageSize: 6, status: "SUBMITTED,UNDER_REVIEW" }),
  });
}

export { Section };
