"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Link2, Radio, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { Badge, Button} from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DetailGrid, Section } from "@/components/layout/page-header";
import { DetailSkeleton, NotFoundState } from "@/components/pages/list-page";
import { RecordActions, RecordShell } from "@/components/records/record-shell";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";
import { RecordPicker } from "@/components/forms/pickers";

type IncidentDetail = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  location: string | null;
  reportedAt: string | null;
  occurredAt: string | null;
  supervisorName: string | null;
  departmentName: string | null;
  participants: Array<{ personId: string; reference: string; firstName: string; lastName: string; role: string }>;
  vehicles: Array<{ vehicleId: string; registration: string; make: string | null; model: string | null; role: string }>;
  assignments: Array<{ id: string; unitId: string | null; callsign: string | null; unitName: string | null; userName: string | null; role: string; assignedAt: string }>;
  reports: Array<{ id: string; reference: string; title: string; status: string }>;
  evidence: Array<{ id: string; itemNumber: string; description: string; status: string }>;
  tasks: Array<{ id: string; reference: string; title: string; status: string; priority: string }>;
  calls: Array<{ id: string; reference: string; status: string; units: string[] }>;
  cases: Array<{ id: string; reference: string; title: string; status: string }>;
};

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, statusLabel, statusColour } = useSession();
  const statusOptions = useStatusOptions("incident");

  const [linkKind, setLinkKind] = React.useState<"person" | "vehicle" | "unit" | null>(null);
  const [target, setTarget] = React.useState<{ id: string; label: string } | null>(null);
  const [role, setRole] = React.useState("INVOLVED");

  const { data, isLoading, error } = useQuery({
    queryKey: ["incidents", id],
    queryFn: () => api.get<IncidentDetail>(`/api/incidents/${id}`),
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["incidents", id] });

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.post(`/api/incidents/${id}/status`, { status }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Status updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const link = useMutation({
    mutationFn: () => {
      if (linkKind === "unit") return api.post(`/api/incidents/${id}/assignments`, { unitId: target!.id, role });
      return api.post(`/api/incidents/${id}/links`, { kind: linkKind!, [`${linkKind}Id`]: target!.id, role });
    },
    onSuccess: async () => {
      await invalidate();
      setLinkKind(null);
      setTarget(null);
      toast.success("Linked");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const unlink = useMutation({
    mutationFn: (params: { kind: string; targetId: string }) =>
      api.delete(`/api/incidents/${id}/links?kind=${params.kind}&targetId=${params.targetId}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Removed");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const escalate = useMutation({
    mutationFn: () => api.post<{ id: string; reference: string }>("/api/cases/from-incident", { incidentId: id }),
    onSuccess: async (created) => {
      await invalidate();
      toast.success(`Case ${created.reference} created`);
      router.push(`/cases/${created.id}`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/incidents/${id}`),
    onSuccess: async () => {
      toast.success("Incident deleted");
      router.push("/incidents");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <NotFoundState />;

  return (
    <>
      <RecordShell
        recordType="incident"
        recordId={data.id}
        reference={data.reference}
        title={data.title}
        subtitle={data.location ?? "No location recorded"}
        status={data.status}
        statusOptions={statusOptions}
        onStatusChange={can("incidents.edit") ? (status) => changeStatus.mutate(status) : undefined}
        statusChanging={changeStatus.isPending}
        priority={data.priority}
        actions={
          <>
            {can("incidents.edit") ? (
              <Button size="sm" variant="outline" onClick={() => setLinkKind("person")}>
                <UserPlus />
                Link person
              </Button>
            ) : null}
            {can("incidents.edit") ? (
              <Button size="sm" variant="outline" onClick={() => setLinkKind("vehicle")}>
                <Link2 />
                Link vehicle
              </Button>
            ) : null}
            {can("incidents.assign") ? (
              <Button size="sm" variant="outline" onClick={() => setLinkKind("unit")}>
                <Radio />
                Assign unit
              </Button>
            ) : null}
            {can("cases.create") ? (
              <Button size="sm" onClick={() => escalate.mutate()} loading={escalate.isPending}>
                <Briefcase />
                Create case
              </Button>
            ) : null}
            <RecordActions canDelete={can("incidents.delete")} onDelete={() => remove.mutate()} deleting={remove.isPending} />
          </>
        }
        overview={
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <Section title="Incident details">
                <DetailGrid
                  items={[
                    { label: "Reported", value: data.reportedAt ? formatDateTime(new Date(data.reportedAt)) : null },
                    { label: "Occurred", value: data.occurredAt ? formatDateTime(new Date(data.occurredAt)) : null },
                    { label: "Location", value: data.location },
                    { label: "Priority", value: <Badge variant={data.priority === "CRITICAL" ? "destructive" : data.priority === "HIGH" ? "warning" : "info"}>{data.priority.toLowerCase()}</Badge> },
                    { label: "Supervisor", value: data.supervisorName },
                    { label: "Department", value: data.departmentName },
                  ]}
                />
                {data.description ? <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{data.description}</p> : null}
              </Section>

              <Section
                title="People involved"
                actions={can("incidents.edit") ? <Button size="sm" variant="ghost" onClick={() => setLinkKind("person")}>Add</Button> : null}
              >
                {data.participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No people linked to this incident yet.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.participants.map((participant) => (
                      <li key={participant.personId} className="flex items-center gap-3 py-2">
                        <a href={`/people/${participant.personId}`} className="min-w-0 flex-1 hover:text-primary">
                          <span className="block truncate text-sm font-medium">
                            {participant.firstName} {participant.lastName}
                          </span>
                          <span className="block text-xs text-muted-foreground">{participant.reference}</span>
                        </a>
                        <Badge variant="muted">{participant.role.toLowerCase()}</Badge>
                        {can("incidents.edit") ? (
                          <Button size="sm" variant="ghost" onClick={() => unlink.mutate({ kind: "person", targetId: participant.personId })}>
                            Remove
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title="Vehicles involved"
                actions={can("incidents.edit") ? <Button size="sm" variant="ghost" onClick={() => setLinkKind("vehicle")}>Add</Button> : null}
              >
                {data.vehicles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vehicles linked.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.vehicles.map((vehicle) => (
                      <li key={vehicle.vehicleId} className="flex items-center gap-3 py-2">
                        <a href={`/vehicles/${vehicle.vehicleId}`} className="min-w-0 flex-1 hover:text-primary">
                          <span className="block truncate text-sm font-medium">{vehicle.registration}</span>
                          <span className="block text-xs text-muted-foreground">{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}</span>
                        </a>
                        <Badge variant="muted">{vehicle.role.toLowerCase()}</Badge>
                        {can("incidents.edit") ? (
                          <Button size="sm" variant="ghost" onClick={() => unlink.mutate({ kind: "vehicle", targetId: vehicle.vehicleId })}>
                            Remove
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Reports">
                {data.reports.length === 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">No reports written for this incident.</p>
                    {can("reports.create") ? (
                      <Button size="sm" variant="outline" onClick={() => router.push(`/reports/new?incidentId=${data.id}`)}>
                        Write report
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.reports.map((report) => (
                      <li key={report.id} className="flex items-center gap-3 py-2">
                        <a href={`/reports/${report.id}`} className="min-w-0 flex-1 hover:text-primary">
                          <span className="block truncate text-sm">{report.title}</span>
                          <span className="block text-xs text-muted-foreground">{report.reference}</span>
                        </a>
                        <Badge colour={statusColour("report", report.status)}>{statusLabel("report", report.status)}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <div className="space-y-3">
              <Section title="Assignments">
                {data.assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No units or people assigned.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.assignments.map((assignment) => (
                      <li key={assignment.id} className="flex items-center gap-2 text-sm">
                        <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{assignment.callsign ?? assignment.userName ?? "Assignment"}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{formatRelative(new Date(assignment.assignedAt))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Tasks">
                {data.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks linked.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.tasks.map((task) => (
                      <li key={task.id}>
                        <a href={`/tasks/${task.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                          <span className="min-w-0 flex-1 truncate">{task.title}</span>
                          <Badge colour={statusColour("task", task.status)}>{statusLabel("task", task.status)}</Badge>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Evidence">
                {data.evidence.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No evidence recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.evidence.slice(0, 6).map((item) => (
                      <li key={item.id}>
                        <a href={`/evidence/${item.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                          <span className="truncate">{item.description}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{item.itemNumber}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {data.cases.length ? (
                <Section title="Cases">
                  <ul className="space-y-2">
                    {data.cases.map((entry) => (
                      <li key={entry.id}>
                        <a href={`/cases/${entry.id}`} className="block text-sm hover:text-primary">
                          <span className="block truncate font-medium">{entry.title}</span>
                          <span className="block text-xs text-muted-foreground">{entry.reference}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {data.calls.length ? (
                <Section title="Dispatch calls">
                  <ul className="space-y-2">
                    {data.calls.map((call) => (
                      <li key={call.id} className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{call.reference}</span>
                        <span className="ml-2">{call.units.join(", ") || "No units"}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </div>
          </div>
        }
        suggestions={[
          ...data.participants.map((participant) => ({ type: "person", id: participant.personId, label: `${participant.firstName} ${participant.lastName}`, reference: participant.reference })),
          ...data.vehicles.map((vehicle) => ({ type: "vehicle", id: vehicle.vehicleId, label: vehicle.registration })),
        ]}
      />

      <Dialog open={linkKind !== null} onOpenChange={(open) => (open ? undefined : setLinkKind(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{linkKind === "unit" ? "Assign a unit" : `Link a ${linkKind}`}</DialogTitle>
            <DialogDescription>Both records record the link in their timelines.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {linkKind === "unit" ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Role</span>
                <select value={role} onChange={(event) => setRole(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                  {["ASSIGNED", "PRIMARY", "SUPPORT"].map((option) => (
                    <option key={option} value={option}>
                      {option.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {linkKind ? (
              <RecordPicker
                resource={linkKind}
                value={target?.id ?? null}
                selected={target ? { id: target.id, label: target.label } : null}
                onChange={(option) => setTarget(option ? { id: option.id, label: option.label } : null)}
                placeholder={`Search ${linkKind}s…`}
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkKind(null)}>
              Cancel
            </Button>
            <Button onClick={() => link.mutate()} loading={link.isPending} disabled={!target}>
              {linkKind === "unit" ? "Assign" : "Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

