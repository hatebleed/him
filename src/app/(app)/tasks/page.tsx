"use client";

import * as React from "react";

import { ListPage } from "@/components/pages/list-page";
import { Badge } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";

type TaskRow = {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  assigneeName: string | null;
  recordType: string | null;
  createdAt: string;
};

export default function TasksPage() {
  const { statusLabel, statusColour } = useSession();

  const columns = React.useMemo(
    () => [
      {
        key: "title",
        header: "Task",
        sortable: true,
        cell: (row: TaskRow) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{row.reference}</p>
          </div>
        ),
      },
      { key: "status", header: "Status", sortable: true, cell: (row: TaskRow) => <Badge colour={statusColour("task", row.status)}>{statusLabel("task", row.status)}</Badge> },
      {
        key: "priority",
        header: "Priority",
        sortable: true,
        cell: (row: TaskRow) => <Badge variant={row.priority === "HIGH" ? "warning" : row.priority === "MEDIUM" ? "info" : "muted"}>{row.priority.toLowerCase()}</Badge>,
      },
      { key: "assigneeName", header: "Assignee", cell: (row: TaskRow) => <span className="truncate">{row.assigneeName ?? "Unassigned"}</span> },
      {
        key: "dueAt",
        header: "Due",
        sortable: true,
        align: "right" as const,
        cell: (row: TaskRow) =>
          row.dueAt ? (
            <span className={`text-xs ${new Date(row.dueAt) < new Date() ? "text-destructive" : "text-muted-foreground"}`}>{formatRelative(new Date(row.dueAt))}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [statusColour, statusLabel],
  );

  return (
    <ListPage<TaskRow>
      resourceType="task"
      endpoint="/api/tasks"
      title="Tasks"
      description="Assign, track and comment on follow-up work."
      columns={columns}
      rowHref={(row) => `/tasks/${row.id}`}
      createHref="/tasks/new"
      createLabel="New task"
      createPermission="tasks.create"
      searchPlaceholder="Search tasks…"
      emptyTitle="No tasks found"
    />
  );
}
