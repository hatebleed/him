"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";
import { Label } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";

type StatusRow = {
  id: string;
  resourceType: string;
  key: string;
  label: string;
  colour: string;
  isDefault: boolean;
  isClosed: boolean;
  active: boolean;
  sortOrder: number;
};

const RESOURCE_TYPES = ["person", "vehicle", "incident", "case", "report", "task", "warrant", "alert", "bolo", "evidence", "unit", "call"];

/** Status configuration: colours, defaults and which statuses close a record. */
export default function AdminStatusesPage() {
  const queryClient = useQueryClient();
  const [resourceType, setResourceType] = React.useState("incident");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ key: "", label: "", colour: "#64748b", isDefault: false, isClosed: false, sortOrder: 100 });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "statuses", resourceType],
    queryFn: () => api.get<{ rows: StatusRow[] }>("/api/admin/statuses", { resourceType }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "statuses"] });
    await queryClient.invalidateQueries({ queryKey: ["session", "shell"] });
  };

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/statuses", { resourceType, key: form.key.toUpperCase(), label: form.label, colour: form.colour, isDefault: form.isDefault, isClosed: form.isClosed, sortOrder: form.sortOrder }),
    onSuccess: async () => {
      await invalidate();
      setOpen(false);
      setForm({ key: "", label: "", colour: "#64748b", isDefault: false, isClosed: false, sortOrder: 100 });
      toast.success("Status created");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const update = useMutation({
    mutationFn: (payload: { id: string; patch: Partial<StatusRow> }) => api.patch(`/api/admin/statuses/${payload.id}`, payload.patch),
    onSuccess: async () => {
      await invalidate();
      toast.success("Status updated");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/statuses/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Status deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Statuses"
        description="Statuses drive lifecycle rules: which are defaults and which close a record."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            Add status
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Label>Record type</Label>
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((status) => (
              <li key={status.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.colour }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {status.label}
                    <span className="font-mono text-xs text-muted-foreground">{status.key}</span>
                    {status.isDefault ? <Badge variant="info">default</Badge> : null}
                    {status.isClosed ? <Badge variant="success">closes record</Badge> : null}
                    {!status.active ? <Badge variant="muted">disabled</Badge> : null}
                  </p>
                </div>
                <input
                  type="color"
                  value={status.colour}
                  onChange={(event) => update.mutate({ id: status.id, patch: { colour: event.target.value } })}
                  className="h-8 w-10 rounded border border-border bg-transparent"
                  aria-label="Status colour"
                />
                <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: status.id, patch: { isDefault: !status.isDefault } })}>
                  {status.isDefault ? "Unset default" : "Make default"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: status.id, patch: { isClosed: !status.isClosed } })}>
                  {status.isClosed ? "Not closing" : "Mark closing"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(status.id)} aria-label="Delete status">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a status</DialogTitle>
            <DialogDescription>New statuses are available immediately on {resourceType} records.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Label</span>
              <Input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Key</span>
              <Input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value.toUpperCase() })} placeholder="AWAITING_REVIEW" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Colour</span>
              <Input type="color" value={form.colour} onChange={(event) => setForm({ ...form, colour: event.target.value })} className="h-9" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Sort order</span>
              <Input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
              Default status
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isClosed} onChange={(event) => setForm({ ...form, isClosed: event.target.checked })} />
              Closes the record
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.label || !form.key}>
              Create status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
