"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { Badge, Button, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Section } from "@/components/layout/page-header";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { useSession } from "@/components/providers/session-provider";

type ReportVersion = {
  id: string;
  version: number;
  title: string;
  body: string;
  changeNote: string | null;
  createdAt: string;
  createdByName: string | null;
};

type ReportDetail = {
  id: string;
  reference: string;
  title: string;
  body: string;
  status: string;
  currentVersion: number;
  authorName: string | null;
  incidentReference: string | null;
  incidentId: string | null;
  caseReference: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  versions: ReportVersion[];
  availableTransitions: Array<{ action: string; label: string; to: string }>;
};

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, statusLabel, statusColour } = useSession();
  const [body, setBody] = React.useState<string | null>(null);
  const [changeNote, setChangeNote] = React.useState("");
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", id],
    queryFn: () => api.get<ReportDetail>(`/api/reports/${id}`),
    retry: false,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["reports", id] });
    setBody(null);
    setChangeNote("");
  };

  const save = useMutation({
    mutationFn: () => api.patch(`/api/reports/${id}`, { title: data!.title, body: body ?? data!.body, changeNote: changeNote || null }),
    onSuccess: async () => {
      await invalidate();
      toast.success(`Saved as version ${(data?.currentVersion ?? 1) + 1}`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const transition = useMutation({
    mutationFn: (payload: { action: string; reason?: string }) => api.post(`/api/reports/${id}/transition`, payload),
    onSuccess: async (_result, variables) => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(`Report ${variables.action.toLowerCase()}ed`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const restore = useMutation({
    mutationFn: (version: number) => api.post(`/api/reports/${id}/versions`, { version }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Version restored");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/reports/${id}`),
    onSuccess: async () => {
      toast.success("Report deleted");
      router.push("/reports");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  const editable = can("reports.edit") && !["FINAL", "ARCHIVED"].includes(data.status);
  const transitions = data.availableTransitions ?? [];

  return (
    <>
      <RecordShell
        recordType="report"
        recordId={data.id}
        reference={data.reference}
        title={data.title}
        subtitle={`Version ${data.currentVersion} · ${data.authorName ?? "Unknown author"}${data.incidentReference ? ` · incident ${data.incidentReference}` : ""}`}
        status={data.status}
        onStatusChange={undefined}
        actions={
          <>
            {transitions.map((item) => (
              <Button
                key={item.action}
                size="sm"
                variant={item.action === "APPROVE" ? "default" : item.action === "REJECT" ? "destructive" : "outline"}
                onClick={() => (item.action === "REJECT" ? setRejectOpen(true) : transition.mutate({ action: item.action }))}
                loading={transition.isPending && transition.variables?.action === item.action}
              >
                {item.action === "SUBMIT" ? <Send /> : item.action === "APPROVE" ? <Check /> : item.action === "REJECT" ? <X /> : <FileText />}
                {item.label}
              </Button>
            ))}
            <RecordActions canDelete={can("reports.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />
          </>
        }
        overview={
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <Section
                title="Report content"
                description={editable ? "Saving creates a new version; history is preserved." : "This report is locked for editing."}
                actions={
                  editable ? (
                    <div className="flex items-center gap-2">
                      {body !== null ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setBody(null)}>
                            Discard
                          </Button>
                          <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>
                            Save new version
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setBody(data.body)}>
                          Edit
                        </Button>
                      )}
                    </div>
                  ) : null
                }
              >
                {body !== null ? (
                  <div className="space-y-2">
                    <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={18} className="font-mono text-[13px]" aria-label="Report body" />
                    <input
                      value={changeNote}
                      onChange={(event) => setChangeNote(event.target.value)}
                      placeholder="What changed in this version?"
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                      aria-label="Change note"
                    />
                  </div>
                ) : (
                  <article className="whitespace-pre-wrap text-sm leading-relaxed">{data.body || "This report has no content yet."}</article>
                )}
              </Section>

              {data.rejectionReason ? (
                <Section title="Rejection reason">
                  <p className="text-sm text-destructive">{data.rejectionReason}</p>
                </Section>
              ) : null}
            </div>

            <div className="space-y-3">
              <Section title="Details">
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <Badge colour={statusColour("report", data.status)}>{statusLabel("report", data.status)}</Badge>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Version</dt>
                    <dd className="tabular">v{data.currentVersion}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{formatDateTime(new Date(data.createdAt))}</dd>
                  </div>
                  {data.submittedAt ? (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">Submitted</dt>
                      <dd>{formatDateTime(new Date(data.submittedAt))}</dd>
                    </div>
                  ) : null}
                  {data.reviewedAt ? (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">Reviewed</dt>
                      <dd>{formatDateTime(new Date(data.reviewedAt))}</dd>
                    </div>
                  ) : null}
                </dl>
              </Section>

              <Section title="Version history">
                {data.versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No versions recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.versions.map((version) => (
                      <li key={version.id} className="rounded-md border border-border/70 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">Version {version.version}</span>
                          {can("reports.edit") && version.version !== data.currentVersion ? (
                            <Button size="sm" variant="ghost" onClick={() => restore.mutate(version.version)}>
                              <RotateCcw />
                              Restore
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {version.createdByName ?? "Unknown"} · {formatRelative(new Date(version.createdAt))}
                        </p>
                        {version.changeNote ? <p className="mt-1 text-xs">{version.changeNote}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </div>
        }
        suggestions={data.incidentId ? [{ type: "incident", id: data.incidentId, label: data.incidentReference ?? "Linked incident", reference: null }] : undefined}
      />

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this report</DialogTitle>
            <DialogDescription>The author is notified and can reopen the report as a draft.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Explain what needs to change…"
            rows={4}
            aria-label="Rejection reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                transition.mutate({ action: "REJECT", reason: rejectReason || undefined });
                setRejectOpen(false);
                setRejectReason("");
              }}
              disabled={!rejectReason.trim()}
            >
              Reject report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

