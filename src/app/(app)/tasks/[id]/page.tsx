"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { Badge, Button, Textarea } from "@/components/ui/primitives";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailLayout } from "@/components/records/detail-layout";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";

type TaskDetail = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  recordType: string | null;
  recordId: string | null;
  comments: Array<{ id: string; body: string; authorName: string | null; createdAt: string }>;
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const statusOptions = useStatusOptions("task");
  const [comment, setComment] = React.useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["tasks", id],
    queryFn: () => api.get<TaskDetail>(`/api/tasks/${id}`),
    retry: false,
  });

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["tasks", id] });

  const changeStatus = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/api/tasks/${id}`, { status, title: data!.title, description: data!.description, priority: data!.priority, assigneeId: data!.assigneeId, dueAt: data!.dueAt }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Task updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const addComment = useMutation({
    mutationFn: (body: string) => api.post(`/api/tasks/${id}/comments`, { body }),
    onSuccess: async () => {
      await invalidate();
      setComment("");
      toast.success("Comment added");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/tasks/${id}`),
    onSuccess: async () => {
      toast.success("Task deleted");
      router.push("/tasks");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  const overdue = data.dueAt && !data.completedAt && new Date(data.dueAt) < new Date();

  return (
    <RecordShell
      recordType="task"
      recordId={data.id}
      reference={data.reference}
      title={data.title}
      subtitle={data.description ?? "No description"}
      status={data.status}
      statusOptions={statusOptions}
      onStatusChange={can("tasks.edit") ? (status) => changeStatus.mutate(status) : undefined}
      priority={data.priority}
      actions={<RecordActions canDelete={can("tasks.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />}
      overview={
        <DetailLayout
          main={
            <>
              <Section title="Task details">
                <DetailGrid
                  items={[
                    { label: "Assignee", value: data.assigneeName ?? "Unassigned" },
                    { label: "Due", value: data.dueAt ? formatDateTime(new Date(data.dueAt)) : null },
                    { label: "Completed", value: data.completedAt ? formatDateTime(new Date(data.completedAt)) : null },
                    { label: "Priority", value: <Badge variant={data.priority === "HIGH" ? "warning" : "info"}>{data.priority.toLowerCase()}</Badge> },
                    {
                      label: "Linked record",
                      value: data.recordType && data.recordId ? (
                        <a href={`/${data.recordType === "incident" ? "incidents" : data.recordType === "case" ? "cases" : "search"}/${data.recordId}`} className="hover:text-primary">
                          {data.recordType}
                        </a>
                      ) : null,
                    },
                    { label: "Status", value: overdue ? <span className="text-destructive">Overdue</span> : "On track" },
                  ]}
                />
              </Section>

              <Section title="Comments">
                {data.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.comments.map((entry) => (
                      <li key={entry.id} className="rounded-md border border-border/70 p-2">
                        <p className="whitespace-pre-wrap text-sm">{entry.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.authorName ?? "Unknown"} · {formatRelative(new Date(entry.createdAt))}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {can("tasks.view") ? (
                  <div className="mt-3 space-y-2">
                    <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment…" rows={3} aria-label="Comment" />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => addComment.mutate(comment)} loading={addComment.isPending} disabled={!comment.trim()}>
                        Comment
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Section>
            </>
          }
        />
      }
      suggestions={data.recordType && data.recordId ? [{ type: data.recordType, id: data.recordId, label: data.recordType, reference: null }] : undefined}
    />
  );
}

