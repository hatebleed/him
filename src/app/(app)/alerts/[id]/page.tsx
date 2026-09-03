"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";
import { Badge, Button } from "@/components/ui/primitives";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailLayout } from "@/components/records/detail-layout";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";

type AlertDetail = {
  id: string;
  reference: string;
  type: string;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  expiresAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  createdByName: string | null;
  personId: string | null;
  vehicleId: string | null;
  incidentId: string | null;
};

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const statusOptions = useStatusOptions("alert");

  const { data, isLoading, error } = useQuery({
    queryKey: ["alerts", id],
    queryFn: () => api.get<AlertDetail>(`/api/alerts/${id}`),
    retry: false,
  });

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["alerts", id] });

  const acknowledge = useMutation({
    mutationFn: () => api.post(`/api/alerts/${id}/acknowledge`, {}),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Alert acknowledged");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/alerts/${id}`, { status, subject: data!.subject, type: data!.type, priority: data!.priority }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Status updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/alerts/${id}`),
    onSuccess: async () => {
      toast.success("Alert deleted");
      router.push("/alerts");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  return (
    <RecordShell
      recordType="alert"
      recordId={data.id}
      reference={data.reference}
      title={data.subject}
      subtitle={data.description ?? "No description"}
      status={data.status}
      statusOptions={statusOptions}
      onStatusChange={can("alerts.edit") ? (status) => changeStatus.mutate(status) : undefined}
      priority={data.priority}
      actions={
        <>
          {can("alerts.acknowledge") && data.status === "ACTIVE" ? (
            <Button size="sm" onClick={() => acknowledge.mutate()} loading={acknowledge.isPending}>
              <Check />
              Acknowledge
            </Button>
          ) : null}
          <RecordActions canDelete={can("alerts.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />
        </>
      }
      overview={
        <DetailLayout
          main={
            <>
              <Section title="Alert details" actions={<Badge variant={data.priority === "CRITICAL" ? "destructive" : "warning"}>{data.priority.toLowerCase()}</Badge>}>
                <DetailGrid
                  items={[
                    { label: "Type", value: data.type.toLowerCase() },
                    { label: "Created by", value: data.createdByName ?? "System" },
                    { label: "Created", value: formatDateTime(new Date(data.createdAt)) },
                    { label: "Expires", value: data.expiresAt ? formatDateTime(new Date(data.expiresAt)) : null },
                    { label: "Acknowledged", value: data.acknowledgedAt ? formatDateTime(new Date(data.acknowledgedAt)) : null },
                  ]}
                />
                {data.description ? <p className="mt-3 whitespace-pre-wrap text-sm">{data.description}</p> : null}
              </Section>
            </>
          }
        />
      }
      suggestions={[
        ...(data.personId ? [{ type: "person", id: data.personId, label: "Linked person", reference: null }] : []),
        ...(data.vehicleId ? [{ type: "vehicle", id: data.vehicleId, label: "Linked vehicle", reference: null }] : []),
      ]}
    />
  );
}

