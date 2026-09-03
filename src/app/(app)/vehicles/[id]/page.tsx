"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatRelative } from "@/lib/utils";
import { Badge} from "@/components/ui/primitives";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";

type VehicleDetail = {
  id: string;
  reference: string;
  registration: string;
  make: string | null;
  model: string | null;
  year: number | null;
  colour: string | null;
  bodyType: string | null;
  fuelType: string | null;
  vin: string | null;
  engineSize: string | null;
  status: string;
  departmentName: string | null;
  notes: string | null;
  owners: Array<{ personId: string; personReference: string; firstName: string; lastName: string; relationship: string }>;
  incidents: Array<{ incidentId: string; reference: string; title: string; status: string; role: string; reportedAt: string | null }>;
  alerts: Array<{ id: string; reference: string; subject: string; status: string }>;
  bolos: Array<{ id: string; reference: string; subject: string; status: string }>;
};

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const statusOptions = useStatusOptions("vehicle");

  const { data, isLoading, error } = useQuery({
    queryKey: ["vehicles", id],
    queryFn: () => api.get<VehicleDetail>(`/api/vehicles/${id}`),
    retry: false,
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/vehicles/${id}`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vehicles", id] });
      toast.success("Status updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/vehicles/${id}`),
    onSuccess: async () => {
      toast.success("Vehicle deleted");
      router.push("/vehicles");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  return (
    <RecordShell
      recordType="vehicle"
      recordId={data.id}
      reference={data.reference}
      title={data.registration}
      subtitle={[data.make, data.model, data.year].filter(Boolean).join(" ") || "Vehicle record"}
      status={data.status}
      statusOptions={statusOptions}
      onStatusChange={can("vehicles.edit") ? (status) => changeStatus.mutate(status) : undefined}
      statusChanging={changeStatus.isPending}
      actions={<RecordActions canDelete={can("vehicles.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />}
      overview={
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <Section title="Vehicle details">
              <DetailGrid
                items={[
                  { label: "Registration", value: data.registration },
                  { label: "Make / model", value: [data.make, data.model].filter(Boolean).join(" ") || "—" },
                  { label: "Year", value: data.year },
                  { label: "Colour", value: data.colour },
                  { label: "Body type", value: data.bodyType },
                  { label: "Fuel", value: data.fuelType },
                  { label: "VIN", value: data.vin },
                  { label: "Engine", value: data.engineSize },
                  { label: "Department", value: data.departmentName },
                ]}
              />
            </Section>
            {data.notes ? (
              <Section title="Notes">
                <p className="whitespace-pre-wrap text-sm">{data.notes}</p>
              </Section>
            ) : null}
          </div>

          <div className="space-y-3">
            <Section title="Owners">
              {data.owners.length === 0 ? (
                <p className="text-sm text-muted-foreground">No owner linked.</p>
              ) : (
                <ul className="space-y-2">
                  {data.owners.map((owner) => (
                    <li key={owner.personId}>
                      <a href={`/people/${owner.personId}`} className="block text-sm hover:text-primary">
                        <span className="block truncate font-medium">
                          {owner.firstName} {owner.lastName}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {owner.relationship.toLowerCase()} · {owner.personReference}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Incidents">
              {data.incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked incidents.</p>
              ) : (
                <ul className="space-y-2">
                  {data.incidents.map((incident) => (
                    <li key={incident.incidentId}>
                      <a href={`/incidents/${incident.incidentId}`} className="block text-sm hover:text-primary">
                        <span className="block truncate font-medium">{incident.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {incident.reference} · {incident.role.toLowerCase()}
                          {incident.reportedAt ? ` · ${formatRelative(new Date(incident.reportedAt))}` : ""}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {data.bolos.length ? (
              <Section title="BOLOs">
                <ul className="space-y-2">
                  {data.bolos.map((bolo) => (
                    <li key={bolo.id}>
                      <a href={`/bolos/${bolo.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                        <span className="truncate">{bolo.subject}</span>
                        <Badge className="ml-auto" variant={bolo.status === "ACTIVE" ? "destructive" : "muted"}>
                          {bolo.status.toLowerCase()}
                        </Badge>
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </div>
        </div>
      }
      suggestions={data.incidents.slice(0, 5).map((incident) => ({ type: "incident", id: incident.incidentId, label: incident.title, reference: incident.reference }))}
    />
  );
}

