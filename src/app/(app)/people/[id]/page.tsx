"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, FileText, Gavel, Link2, Mail, MapPin, Phone, Plus, ScanEye} from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatDate, formatRelative } from "@/lib/utils";
import { Badge, Button} from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";
import { RecordPicker } from "@/components/forms/pickers";

type PersonDetail = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  alias: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  occupation: string | null;
  status: string;
  riskLevel: string | null;
  departmentName: string | null;
  notes: string | null;
  identifiers: Array<{ id: string; type: string; value: string; issuingAuthority: string | null }>;
  contacts: Array<{ id: string; type: string; value: string; label: string | null; isPrimary: boolean }>;
  addresses: Array<{ id: string; type: string; line1: string; city: string | null; region: string | null; postalCode: string | null; country: string | null; isPrimary: boolean }>;
  vehicles: Array<{ vehicleId: string; registration: string; make: string | null; model: string | null; relationship: string }>;
  incidents: Array<{ incidentId: string; reference: string; title: string; status: string; role: string; reportedAt: string | null }>;
  reports: Array<{ id: string; reference: string; title: string; status: string }>;
  warrants: Array<{ id: string; reference: string; status: string; type: string }>;
  alerts: Array<{ id: string; reference: string; subject: string; status: string }>;
  bolos: Array<{ id: string; reference: string; subject: string; status: string }>;
  customFields: Record<string, unknown>;
};

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, statusLabel, statusColour } = useSession();
  const statusOptions = useStatusOptions("person");
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [vehicle, setVehicle] = React.useState<{ id: string; label: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["people", id],
    queryFn: () => api.get<PersonDetail>(`/api/people/${id}`),
    retry: false,
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/people/${id}`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["people", id] });
      toast.success("Status updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const linkVehicle = useMutation({
    mutationFn: () => api.post(`/api/people/${id}/vehicles`, { vehicleId: vehicle!.id, relationship: "OWNER", isPrimary: false }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["people", id] });
      setLinkOpen(false);
      setVehicle(null);
      toast.success("Vehicle linked");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/people/${id}`),
    onSuccess: async () => {
      toast.success("Record deleted");
      router.push("/people");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  const name = `${data.firstName} ${data.lastName}`;

  return (
    <>
      <RecordShell
        recordType="person"
        recordId={data.id}
        reference={data.reference}
        title={name}
        subtitle={`${data.occupation ?? "No occupation recorded"}${data.alias ? ` · known as “${data.alias}”` : ""}`}
        status={data.status}
        statusOptions={statusOptions}
        onStatusChange={can("people.edit") ? (status) => changeStatus.mutate(status) : undefined}
        statusChanging={changeStatus.isPending}
        actions={
          <>
            {can("people.edit") ? (
              <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                <Link2 />
                Link vehicle
              </Button>
            ) : null}
            <RecordActions canDelete={can("people.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />
          </>
        }
        overview={
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <Section title="Identity" actions={<Badge colour={statusColour("person", data.status)}>{statusLabel("person", data.status)}</Badge>}>
                <DetailGrid
                  items={[
                    { label: "Full name", value: `${data.firstName} ${data.middleName ?? ""} ${data.lastName}`.replace(/\s+/g, " ") },
                    { label: "Date of birth", value: data.dateOfBirth ? formatDate(new Date(data.dateOfBirth)) : null },
                    { label: "Gender", value: data.gender },
                    { label: "Nationality", value: data.nationality },
                    { label: "Occupation", value: data.occupation },
                    { label: "Department", value: data.departmentName },
                    { label: "Risk level", value: data.riskLevel ? <Badge variant={data.riskLevel === "HIGH" ? "destructive" : "warning"}>{data.riskLevel.toLowerCase()}</Badge> : null },
                  ]}
                />
              </Section>

              <Section title="Identifiers">
                {data.identifiers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No identifiers recorded.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.identifiers.map((identifier) => (
                      <li key={identifier.id} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="text-sm">{identifier.value}</span>
                        <span className="text-xs text-muted-foreground">
                          {identifier.type.toLowerCase()} · {identifier.issuingAuthority ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Contact details">
                {data.contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contact details recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.contacts.map((contact) => (
                      <li key={contact.id} className="flex items-center gap-2 text-sm">
                        {contact.type === "EMAIL" ? <Mail className="h-3.5 w-3.5 text-muted-foreground" /> : <Phone className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="truncate">{contact.value}</span>
                        {contact.isPrimary ? <Badge variant="muted">primary</Badge> : null}
                        <span className="ml-auto text-xs text-muted-foreground">{contact.label ?? contact.type.toLowerCase()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Addresses">
                {data.addresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No addresses recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.addresses.map((address) => (
                      <li key={address.id} className="flex items-start gap-2 text-sm">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          {address.line1}
                          {address.city ? `, ${address.city}` : ""}
                          {address.postalCode ? ` ${address.postalCode}` : ""}
                          <span className="ml-2 text-xs text-muted-foreground">{address.type.toLowerCase()}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {data.notes ? (
                <Section title="Notes">
                  <p className="whitespace-pre-wrap text-sm">{data.notes}</p>
                </Section>
              ) : null}
            </div>

            <div className="space-y-3">
              <Section title="Vehicles" actions={can("people.edit") ? <Button size="sm" variant="ghost" onClick={() => setLinkOpen(true)}><Plus />Link</Button> : null}>
                {data.vehicles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vehicles linked.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.vehicles.map((entry) => (
                      <li key={`${entry.vehicleId}-${entry.relationship}`}>
                        <a href={`/vehicles/${entry.vehicleId}`} className="flex items-center gap-2 text-sm hover:text-primary">
                          <Car className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate font-medium">{entry.registration}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{entry.relationship.toLowerCase()}</span>
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
                    {data.incidents.slice(0, 8).map((incident) => (
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

              {data.warrants.length ? (
                <Section title="Warrants">
                  <ul className="space-y-2">
                    {data.warrants.map((warrant) => (
                      <li key={warrant.id}>
                        <a href={`/warrants/${warrant.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                          <Gavel className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{warrant.reference}</span>
                          <Badge className="ml-auto" variant={warrant.status === "ACTIVE" ? "destructive" : "muted"}>
                            {warrant.status.toLowerCase()}
                          </Badge>
                        </a>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {data.reports.length ? (
                <Section title="Reports">
                  <ul className="space-y-2">
                    {data.reports.slice(0, 6).map((report) => (
                      <li key={report.id}>
                        <a href={`/reports/${report.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{report.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {data.bolos.length ? (
                <Section title="BOLOs">
                  <ul className="space-y-2">
                    {data.bolos.map((bolo) => (
                      <li key={bolo.id}>
                        <a href={`/bolos/${bolo.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                          <ScanEye className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{bolo.subject}</span>
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

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link a vehicle</DialogTitle>
            <DialogDescription>The vehicle will appear on both records and in both timelines.</DialogDescription>
          </DialogHeader>
          <RecordPicker
            resource="vehicle"
            value={vehicle?.id ?? null}
            selected={vehicle ? { id: vehicle.id, label: vehicle.label } : null}
            onChange={(option) => setVehicle(option ? { id: option.id, label: option.label } : null)}
            placeholder="Search vehicles…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => linkVehicle.mutate()} loading={linkVehicle.isPending} disabled={!vehicle}>
              Link vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

