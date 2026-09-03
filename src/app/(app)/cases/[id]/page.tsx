"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";
import { Badge, Button } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailLayout, RelatedList } from "@/components/records/detail-layout";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { RecordPicker } from "@/components/forms/pickers";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";

type CaseDetail = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  leadName: string | null;
  leadId: string | null;
  departmentName: string | null;
  openedAt: string | null;
  closedAt: string | null;
  reviewNotes: string | null;
  incidents: Array<{ incidentId: string; reference: string; title: string; status: string }>;
  reports: Array<{ id: string; reference: string; title: string; status: string }>;
  tasks: Array<{ id: string; reference: string; title: string; status: string }>;
};

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, statusColour, statusLabel } = useSession();
  const statusOptions = useStatusOptions("case");
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [incident, setIncident] = React.useState<{ id: string; label: string } | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [reviewStatus, setReviewStatus] = React.useState("RESOLVED");
  const [reviewNotes, setReviewNotes] = React.useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["cases", id],
    queryFn: () => api.get<CaseDetail>(`/api/cases/${id}`),
    retry: false,
  });

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["cases", id] });

  const changeStatus = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/api/cases/${id}`, { status, title: data!.title, description: data!.description, priority: data!.priority, incidentIds: data!.incidents.map((entry) => entry.incidentId) }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Status updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const addIncident = useMutation({
    mutationFn: () =>
      api.patch(`/api/cases/${id}`, {
        title: data!.title,
        description: data!.description,
        status: data!.status,
        priority: data!.priority,
        incidentIds: [...data!.incidents.map((entry) => entry.incidentId), incident!.id],
      }),
    onSuccess: async () => {
      await invalidate();
      setLinkOpen(false);
      setIncident(null);
      toast.success("Incident linked");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const review = useMutation({
    mutationFn: () => api.post(`/api/cases/${id}/review`, { status: reviewStatus, reviewNotes: reviewNotes || null }),
    onSuccess: async () => {
      await invalidate();
      setReviewOpen(false);
      toast.success("Review recorded");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/cases/${id}`),
    onSuccess: async () => {
      toast.success("Case deleted");
      router.push("/cases");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  return (
    <>
      <RecordShell
        recordType="case"
        recordId={data.id}
        reference={data.reference}
        title={data.title}
        subtitle={data.description ?? "No description"}
        status={data.status}
        statusOptions={statusOptions}
        onStatusChange={can("cases.edit") ? (status) => changeStatus.mutate(status) : undefined}
        priority={data.priority}
        actions={
          <>
            {can("cases.edit") ? (
              <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                Link incident
              </Button>
            ) : null}
            {can("cases.close") ? (
              <Button size="sm" onClick={() => setReviewOpen(true)}>
                Record review
              </Button>
            ) : null}
            <RecordActions canDelete={can("cases.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />
          </>
        }
        overview={
          <DetailLayout
            main={
              <>
                <Section title="Case details">
                  <DetailGrid
                    items={[
                      { label: "Opened", value: data.openedAt ? formatDateTime(new Date(data.openedAt)) : null },
                      { label: "Closed", value: data.closedAt ? formatDateTime(new Date(data.closedAt)) : null },
                      { label: "Lead", value: data.leadName },
                      { label: "Department", value: data.departmentName },
                      { label: "Priority", value: data.priority.toLowerCase() },
                      { label: "Linked incidents", value: String(data.incidents.length) },
                    ]}
                  />
                </Section>

                <Section title="Incidents in this case">
                  {data.incidents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No incidents linked.</p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {data.incidents.map((entry) => (
                        <li key={entry.incidentId} className="flex items-center gap-3 py-2">
                          <a href={`/incidents/${entry.incidentId}`} className="min-w-0 flex-1 hover:text-primary">
                            <span className="block truncate text-sm font-medium">{entry.title}</span>
                            <span className="block text-xs text-muted-foreground">{entry.reference}</span>
                          </a>
                          <Badge colour={statusColour("incident", entry.status)}>{statusLabel("incident", entry.status)}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {data.reviewNotes ? (
                  <Section title="Review notes">
                    <p className="whitespace-pre-wrap text-sm">{data.reviewNotes}</p>
                  </Section>
                ) : null}
              </>
            }
            sidebar={
              <>
                <RelatedList
                  title="Reports"
                  items={data.reports.map((report) => ({ id: report.id, title: report.title, subtitle: report.reference, href: `/reports/${report.id}` }))}
                />
                <RelatedList
                  title="Tasks"
                  items={data.tasks.map((task) => ({ id: task.id, title: task.title, subtitle: task.reference, href: `/tasks/${task.id}` }))}
                />
              </>
            }
          />
        }
        suggestions={data.incidents.map((entry) => ({ type: "incident", id: entry.incidentId, label: entry.title, reference: entry.reference }))}
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link an incident</DialogTitle>
            <DialogDescription>The incident will show this case on its overview.</DialogDescription>
          </DialogHeader>
          <RecordPicker
            resource="incident"
            value={incident?.id ?? null}
            selected={incident ? { id: incident.id, label: incident.label } : null}
            onChange={(option) => setIncident(option ? { id: option.id, label: option.label } : null)}
            placeholder="Search incidents…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addIncident.mutate()} loading={addIncident.isPending} disabled={!incident}>
              Link incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record a review</DialogTitle>
            <DialogDescription>Reviews are written to the timeline and the audit trail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Outcome</span>
              <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {statusOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
              rows={4}
              placeholder="Review notes…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              aria-label="Review notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => review.mutate()} loading={review.isPending}>
              Save review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
