"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailLayout } from "@/components/records/detail-layout";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";

type EvidenceDetail = {
  id: string;
  itemNumber: string;
  description: string;
  categoryId: string | null;
  quantity: number;
  unitLabel: string | null;
  location: string | null;
  status: string;
  incidentId: string | null;
  incidentReference: string | null;
  custodianId: string | null;
  custodianName: string | null;
  collectedAt: string | null;
  collectedFrom: string | null;
  notes: string | null;
  events: Array<{ id: string; type: string; fromLocation: string | null; toLocation: string | null; toCustodianName: string | null; notes: string | null; occurredAt: string }>;
};

export default function EvidenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const statusOptions = useStatusOptions("evidence");
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [toLocation, setToLocation] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["evidence", id],
    queryFn: () => api.get<EvidenceDetail>(`/api/evidence/${id}`),
    retry: false,
  });

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["evidence", id] });

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/evidence/${id}`, { status, description: data!.description, quantity: data!.quantity, location: data!.location }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Status updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const transfer = useMutation({
    mutationFn: () => api.post(`/api/evidence/${id}/custody`, { type: "TRANSFER", toLocation: toLocation || null, notes: notes || null }),
    onSuccess: async () => {
      await invalidate();
      setTransferOpen(false);
      setToLocation("");
      setNotes("");
      toast.success("Custody event recorded");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/evidence/${id}`),
    onSuccess: async () => {
      toast.success("Evidence deleted");
      router.push("/evidence");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  return (
    <>
      <RecordShell
        recordType="evidence"
        recordId={data.id}
        reference={data.itemNumber}
        title={data.description}
        subtitle={data.location ?? "No storage location"}
        status={data.status}
        statusOptions={statusOptions}
        onStatusChange={can("evidence.edit") ? (status) => changeStatus.mutate(status) : undefined}
        actions={
          <>
            {can("evidence.transfer") ? (
              <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                Record transfer
              </Button>
            ) : null}
            <RecordActions canDelete={can("evidence.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />
          </>
        }
        overview={
          <DetailLayout
            main={
              <>
                <Section title="Item details">
                  <DetailGrid
                    items={[
                      { label: "Item number", value: <span className="font-mono text-xs">{data.itemNumber}</span> },
                      { label: "Quantity", value: `${data.quantity}${data.unitLabel ? ` ${data.unitLabel}` : ""}` },
                      { label: "Location", value: data.location },
                      { label: "Custodian", value: data.custodianName },
                      { label: "Collected", value: data.collectedAt ? formatDateTime(new Date(data.collectedAt)) : null },
                      { label: "Collected from", value: data.collectedFrom },
                      {
                        label: "Incident",
                        value: data.incidentId ? (
                          <a href={`/incidents/${data.incidentId}`} className="hover:text-primary">
                            {data.incidentReference}
                          </a>
                        ) : null,
                      },
                    ]}
                  />
                  {data.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{data.notes}</p> : null}
                </Section>

                <Section title="Chain of custody" description="Custody events are append-only.">
                  {data.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No custody events recorded.</p>
                  ) : (
                    <ol className="space-y-3">
                      {data.events.map((event) => (
                        <li key={event.id} className="rounded-md border border-border/70 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{event.type.replace(/_/g, " ").toLowerCase()}</span>
                            <span className="text-xs text-muted-foreground">{formatRelative(new Date(event.occurredAt))}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.fromLocation ? `${event.fromLocation} → ` : ""}
                            {event.toLocation ?? "—"}
                            {event.toCustodianName ? ` · ${event.toCustodianName}` : ""}
                          </p>
                          {event.notes ? <p className="mt-1 text-sm">{event.notes}</p> : null}
                          <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(new Date(event.occurredAt))}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </Section>
              </>
            }
          />
        }
        suggestions={data.incidentId ? [{ type: "incident", id: data.incidentId, label: data.incidentReference ?? "Linked incident", reference: data.incidentReference }] : undefined}
      />

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record a custody transfer</DialogTitle>
            <DialogDescription>Transfers are permanent audit records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">New location</span>
              <input
                value={toLocation}
                onChange={(event) => setToLocation(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Laboratory"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Reason for transfer…"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => transfer.mutate()} loading={transfer.isPending}>
              Record transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

