"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Radio, RadioTower, Siren } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Skeleton, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { PageHeader, StatTile } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { formatRelative } from "@/lib/utils";
import { RecordPicker } from "@/components/forms/pickers";

type DispatchCall = {
  id: string;
  reference: string;
  type: string;
  priority: string;
  status: string;
  description: string | null;
  location: string | null;
  callerName: string | null;
  callerPhone: string | null;
  receivedAt: string;
  incidentId: string | null;
  units: Array<{ id: string; callsign: string; name: string; status: string; assignedAt: string }>;
};

type DispatchUnit = { id: string; name: string; callsign: string; status: string; location: string | null; activeCallId: string | null };

/**
 * Dispatch console.
 * Create calls, assign units, update unit status and escalate to incidents.
 */
export default function DispatchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { can, statusLabel, statusColour } = useSession();
  const selectedCallId = params.get("call");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ type: "GENERAL", priority: "MEDIUM", description: "", location: "", callerName: "", callerPhone: "" });
  const [unitTarget, setUnitTarget] = React.useState<{ id: string; label: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dispatch"],
    queryFn: () => api.get<{ calls: DispatchCall[]; units: DispatchUnit[] }>("/api/dispatch"),
    refetchInterval: 15_000,
  });

  const { data: allCalls } = useQuery({
    queryKey: ["calls", "recent"],
    queryFn: () => api.get<{ rows: DispatchCall[] }>("/api/calls", { pageSize: 50 }),
    refetchInterval: 30_000,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["dispatch"] });
    await queryClient.invalidateQueries({ queryKey: ["calls"] });
  };

  const createCall = useMutation({
    mutationFn: () => api.post<{ id: string; reference: string }>("/api/calls", { ...form, status: "PENDING" }),
    onSuccess: async (created) => {
      await invalidate();
      setCreateOpen(false);
      setForm({ type: "GENERAL", priority: "MEDIUM", description: "", location: "", callerName: "", callerPhone: "" });
      toast.success(`Call ${created.reference} created`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const assignUnit = useMutation({
    mutationFn: () => api.post(`/api/calls/${selectedCallId}/units`, { unitId: unitTarget!.id, action: "ASSIGN" }),
    onSuccess: async () => {
      await invalidate();
      setUnitTarget(null);
      toast.success("Unit assigned");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const unassignUnit = useMutation({
    mutationFn: (unitId: string) => api.delete(`/api/calls/${selectedCallId}/units?unitId=${unitId}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Unit removed");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const escalate = useMutation({
    mutationFn: (callId: string) => api.post<{ id: string; reference: string }>(`/api/calls/${callId}/escalate`, {}),
    onSuccess: async (incident) => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast.success(`Escalated to incident ${incident.reference}`);
      router.push(`/incidents/${incident.id}`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const calls = data?.calls ?? [];
  const units = data?.units ?? [];
  const selected = [...calls, ...(allCalls?.rows ?? [])].find((call) => call.id === selectedCallId) ?? calls[0] ?? null;

  const counts = {
    pending: calls.filter((call) => call.status === "PENDING").length,
    dispatched: calls.filter((call) => ["DISPATCHED", "ON_SCENE"].includes(call.status)).length,
    available: units.filter((unit) => unit.status === "AVAILABLE").length,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dispatch"
        description="Receive calls, assign units and escalate to incidents."
        actions={
          can("calls.create") ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              New call
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Awaiting dispatch" value={counts.pending} icon={<RadioTower />} />
        <StatTile label="Units committed" value={counts.dispatched} icon={<Siren />} />
        <StatTile label="Units available" value={counts.available} icon={<Radio />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Active calls</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : error ? (
              <p className="p-2 text-sm text-destructive">{(error as Error).message}</p>
            ) : calls.length === 0 ? (
              <EmptyState icon={<RadioTower className="h-5 w-5" />} title="No active calls" description="Create a call to begin dispatching." />
            ) : (
              <ul className="space-y-1">
                {calls.map((call) => (
                  <li key={call.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/dispatch?call=${call.id}`)}
                      className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                        selected?.id === call.id ? "border-primary/50 bg-primary/10" : "border-transparent hover:bg-secondary/60"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs">{call.reference}</span>
                        <Badge variant={call.priority === "CRITICAL" ? "destructive" : call.priority === "HIGH" ? "warning" : "info"}>
                          {call.priority.toLowerCase()}
                        </Badge>
                      </span>
                      <span className="mt-1 block truncate text-sm">{call.description ?? "No description"}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {call.location ?? "No location"} · {formatRelative(new Date(call.receivedAt))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{selected ? `Call ${selected.reference}` : "Call detail"}</CardTitle>
            {selected ? <Badge colour={statusColour("call", selected.status)}>{statusLabel("call", selected.status)}</Badge> : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <EmptyState icon={<RadioTower className="h-5 w-5" />} title="Select a call" description="Choose a call from the list to see its details." />
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm">{selected.description ?? "No description recorded."}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.location ?? "No location"} · caller: {selected.callerName ?? "unknown"}
                    {selected.callerPhone ? ` (${selected.callerPhone})` : ""}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned units</p>
                  {selected.units.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No units assigned.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {selected.units.map((unit) => (
                        <li key={unit.id} className="flex items-center gap-2 rounded-md border border-border/70 px-2.5 py-1.5">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{unit.callsign}</span>
                          <Badge variant="muted">{unit.status.toLowerCase().replace(/_/g, " ")}</Badge>
                          {can("dispatch.manage") ? (
                            <Button size="sm" variant="ghost" onClick={() => unassignUnit.mutate(unit.id)}>
                              Remove
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {can("dispatch.manage") ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[200px] flex-1">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Assign a unit</p>
                      <RecordPicker
                        resource="unit"
                        value={unitTarget?.id ?? null}
                        selected={unitTarget ? { id: unitTarget.id, label: unitTarget.label } : null}
                        onChange={(option) => setUnitTarget(option ? { id: option.id, label: option.label } : null)}
                        placeholder="Search units…"
                      />
                    </div>
                    <Button onClick={() => assignUnit.mutate()} loading={assignUnit.isPending} disabled={!unitTarget}>
                      Assign
                    </Button>
                    {!selected.incidentId && can("incidents.create") ? (
                      <Button variant="outline" onClick={() => escalate.mutate(selected.id)} loading={escalate.isPending}>
                        <Siren />
                        Escalate to incident
                      </Button>
                    ) : selected.incidentId ? (
                      <Button variant="ghost" onClick={() => router.push(`/incidents/${selected.incidentId}`)}>
                        View incident
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New call</DialogTitle>
            <DialogDescription>Record the details as they are reported.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <select
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {["GENERAL", "TRAFFIC", "WELFARE", "PRIORITY"].map((option) => (
                  <option key={option} value={option}>
                    {option.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Priority</span>
              <select
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((option) => (
                  <option key={option} value={option}>
                    {option.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Location</span>
              <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Address or landmark" />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Caller name</span>
              <Input value={form.callerName} onChange={(event) => setForm({ ...form, callerName: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Caller phone</span>
              <Input value={form.callerPhone} onChange={(event) => setForm({ ...form, callerPhone: event.target.value })} />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createCall.mutate()} loading={createCall.isPending} disabled={!form.description.trim()}>
              Create call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
