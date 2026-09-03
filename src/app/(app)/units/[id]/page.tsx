"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { Badge } from "@/components/ui/primitives";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailLayout, RelatedList } from "@/components/records/detail-layout";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordShell } from "@/components/records/record-shell";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";

type UnitDetail = {
  id: string;
  name: string;
  callsign: string;
  status: string;
  statusNote: string | null;
  statusUpdatedAt: string | null;
  location: string | null;
  departmentName: string | null;
  vehicleRegistration: string | null;
  notes: string | null;
  personnel: Array<{ id: string; name: string; jobTitle: string | null; role: string; joinedAt: string | null }>;
  recentCalls: Array<{ id: string; reference: string; status: string; priority: string; receivedAt: string }>;
};

export default function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { statusLabel, statusColour } = useSession();
  const statusOptions = useStatusOptions("unit");

  const { data, isLoading, error } = useQuery({
    queryKey: ["units", id],
    queryFn: () => api.get<UnitDetail>(`/api/units/${id}`),
    retry: false,
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  return (
    <RecordShell
      recordType="unit"
      recordId={data.id}
      reference={data.callsign}
      title={`${data.callsign} · ${data.name}`}
      subtitle={data.location ?? "No location reported"}
      status={data.status}
      statusOptions={statusOptions}
      overview={
        <DetailLayout
          main={
            <>
              <Section title="Unit details" actions={<Badge colour={statusColour("unit", data.status)}>{statusLabel("unit", data.status)}</Badge>}>
                <DetailGrid
                  items={[
                    { label: "Callsign", value: data.callsign },
                    { label: "Name", value: data.name },
                    { label: "Department", value: data.departmentName },
                    { label: "Vehicle", value: data.vehicleRegistration },
                    { label: "Location", value: data.location },
                    { label: "Status updated", value: data.statusUpdatedAt ? formatRelative(new Date(data.statusUpdatedAt)) : null },
                  ]}
                />
                {data.statusNote ? <p className="mt-3 text-sm text-muted-foreground">Note: {data.statusNote}</p> : null}
                {data.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{data.notes}</p> : null}
              </Section>

              <Section title="Personnel">
                {data.personnel.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No personnel assigned.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.personnel.map((member) => (
                      <li key={member.id} className="flex items-center gap-3 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{member.name}</span>
                          <span className="block text-xs text-muted-foreground">{member.jobTitle ?? "—"}</span>
                        </span>
                        <Badge variant="muted">{member.role.toLowerCase()}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          }
          sidebar={
            <RelatedList
              title="Recent calls"
              items={data.recentCalls.map((call) => ({
                id: call.id,
                title: call.reference,
                subtitle: `${call.priority.toLowerCase()} · ${formatRelative(new Date(call.receivedAt))}`,
                href: `/dispatch?call=${call.id}`,
              }))}
              empty="This unit has not been dispatched recently."
            />
          }
        />
      }
    />
  );
}
