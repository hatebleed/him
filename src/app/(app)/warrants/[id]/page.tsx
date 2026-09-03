"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import {} from "@/components/ui/primitives";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailLayout } from "@/components/records/detail-layout";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";

type WarrantDetail = {
  id: string;
  reference: string;
  type: string;
  status: string;
  description: string | null;
  issuingAuthority: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  executedAt: string | null;
  notes: string | null;
  personId: string;
  personName: string;
  personReference: string;
};

export default function WarrantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const statusOptions = useStatusOptions("warrant");

  const { data, isLoading, error } = useQuery({
    queryKey: ["warrants", id],
    queryFn: () => api.get<WarrantDetail>(`/api/warrants/${id}`),
    retry: false,
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/warrants/${id}`, { status, personId: data!.personId, type: data!.type }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["warrants", id] });
      toast.success("Status updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/warrants/${id}`),
    onSuccess: async () => {
      toast.success("Warrant deleted");
      router.push("/warrants");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  return (
    <RecordShell
      recordType="warrant"
      recordId={data.id}
      reference={data.reference}
      title={`${data.type.toLowerCase()} warrant · ${data.personName}`}
      subtitle={data.description ?? "No description"}
      status={data.status}
      statusOptions={statusOptions}
      onStatusChange={can("warrants.edit") ? (status) => changeStatus.mutate(status) : undefined}
      actions={<RecordActions canDelete={can("warrants.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />}
      overview={
        <DetailLayout
          main={
            <>
              <Section title="Warrant details">
                <DetailGrid
                  items={[
                    { label: "Person", value: <a href={`/people/${data.personId}`} className="hover:text-primary">{data.personName}</a> },
                    { label: "Person reference", value: data.personReference },
                    { label: "Type", value: data.type.toLowerCase() },
                    { label: "Issuing authority", value: data.issuingAuthority },
                    { label: "Issued", value: data.issuedAt ? formatDate(new Date(data.issuedAt)) : null },
                    { label: "Expires", value: data.expiresAt ? formatDate(new Date(data.expiresAt)) : null },
                    { label: "Executed", value: data.executedAt ? formatDate(new Date(data.executedAt)) : null },
                  ]}
                />
              </Section>
              {data.notes ? (
                <Section title="Notes">
                  <p className="whitespace-pre-wrap text-sm">{data.notes}</p>
                </Section>
              ) : null}
            </>
          }
        />
      }
      suggestions={[{ type: "person", id: data.personId, label: data.personName, reference: data.personReference }]}
    />
  );
}

