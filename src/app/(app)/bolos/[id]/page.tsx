"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";
import { Badge} from "@/components/ui/primitives";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailLayout } from "@/components/records/detail-layout";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";

type BoloDetail = {
  id: string;
  reference: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  person: { id: string; reference: string; firstName: string; lastName: string } | null;
  vehicle: { id: string; registration: string; make: string | null; model: string | null } | null;
  incident: { id: string; reference: string; title: string } | null;
};

export default function BoloDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const statusOptions = useStatusOptions("bolo");

  const { data, isLoading, error } = useQuery({
    queryKey: ["bolos", id],
    queryFn: () => api.get<BoloDetail>(`/api/bolos/${id}`),
    retry: false,
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/bolos/${id}`, { status, subject: data!.subject, description: data!.description, priority: data!.priority }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bolos", id] });
      toast.success("Status updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/bolos/${id}`),
    onSuccess: async () => {
      toast.success("BOLO deleted");
      router.push("/bolos");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  return (
    <RecordShell
      recordType="bolo"
      recordId={data.id}
      reference={data.reference}
      title={data.subject}
      subtitle={data.description ?? "No description"}
      status={data.status}
      statusOptions={statusOptions}
      onStatusChange={can("bolos.edit") ? (status) => changeStatus.mutate(status) : undefined}
      priority={data.priority}
      actions={<RecordActions canDelete={can("bolos.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />}
      overview={
        <DetailLayout
          main={
            <>
              <Section title="Notice">
                <DetailGrid
                  items={[
                    { label: "Created", value: formatDateTime(new Date(data.createdAt)) },
                    { label: "Expires", value: data.expiresAt ? formatDateTime(new Date(data.expiresAt)) : null },
                    { label: "Priority", value: <Badge variant={data.priority === "HIGH" ? "warning" : "info"}>{data.priority.toLowerCase()}</Badge> },
                    {
                      label: "Person",
                      value: data.person ? (
                        <a href={`/people/${data.person.id}`} className="hover:text-primary">
                          {data.person.firstName} {data.person.lastName}
                        </a>
                      ) : null,
                    },
                    {
                      label: "Vehicle",
                      value: data.vehicle ? (
                        <a href={`/vehicles/${data.vehicle.id}`} className="hover:text-primary">
                          {data.vehicle.registration}
                        </a>
                      ) : null,
                    },
                    {
                      label: "Incident",
                      value: data.incident ? (
                        <a href={`/incidents/${data.incident.id}`} className="hover:text-primary">
                          {data.incident.reference}
                        </a>
                      ) : null,
                    },
                  ]}
                />
                {data.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{data.notes}</p> : null}
              </Section>
            </>
          }
        />
      }
      suggestions={[
        ...(data.person ? [{ type: "person", id: data.person.id, label: `${data.person.firstName} ${data.person.lastName}`, reference: data.person.reference }] : []),
        ...(data.vehicle ? [{ type: "vehicle", id: data.vehicle.id, label: data.vehicle.registration, reference: null }] : []),
      ]}
    />
  );
}

