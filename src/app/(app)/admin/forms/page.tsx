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

type FormRow = { id: string; key: string; name: string; description: string | null; resourceType: string; status: string; version: number; fieldCount: number };
type FormField = { key: string; label: string; type: string; section?: string | null; required?: boolean; options?: Array<{ label: string; value: string }> | null; width?: string; sortOrder?: number };
type FormDetail = FormRow & { fields: FormField[] };

const TYPES = ["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "MULTI_SELECT", "CHECKBOX", "RADIO", "USER"];
const RESOURCE_TYPES = ["incident", "case", "report", "person", "vehicle", "evidence", "task"];

/** Form builder: define fields, publish, then submit against any record. */
export default function AdminFormsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<FormDetail | null>(null);
  const [form, setForm] = React.useState({ key: "", name: "", description: "", resourceType: "incident" });
  const [fields, setFields] = React.useState<FormField[]>([{ key: "", label: "", type: "TEXT" }]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "forms"],
    queryFn: () => api.get<{ rows: FormRow[] }>("/api/forms"),
  });

  const create = useMutation({
    mutationFn: () => api.post("/api/forms", { ...form, fields: fields.filter((field) => field.label && field.key) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "forms"] });
      setOpen(false);
      setForm({ key: "", name: "", description: "", resourceType: "incident" });
      setFields([{ key: "", label: "", type: "TEXT" }]);
      toast.success("Form created");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const publish = useMutation({
    mutationFn: (formId: string) => api.patch(`/api/forms/${formId}`, { status: "PUBLISHED" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "forms"] });
      toast.success("Form published");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (formId: string) => api.delete(`/api/forms/${formId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "forms"] });
      toast.success("Form deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Forms"
        description="Build forms with conditional fields and submit them against records."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            New form
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No forms created yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {entry.name}
                    <Badge variant={entry.status === "PUBLISHED" ? "success" : "muted"}>{entry.status.toLowerCase()}</Badge>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.resourceType} · {entry.fieldCount} fields · v{entry.version}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => api.get<FormDetail>(`/api/forms/${entry.id}`).then(setActive)}>
                  View fields
                </Button>
                {entry.status !== "PUBLISHED" ? (
                  <Button size="sm" variant="ghost" onClick={() => publish.mutate(entry.id)}>
                    Publish
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(entry.id)} aria-label="Delete form">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New form</DialogTitle>
            <DialogDescription>Fields are rendered automatically on the form runtime.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Key</span>
              <Input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="incident_supplementary" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Applies to</span>
              <Select value={form.resourceType} onValueChange={(value) => setForm({ ...form, resourceType: value })}>
                <SelectTrigger>
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
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFields([...fields, { key: "", label: "", type: "TEXT" }])}
              >
                <Plus />
                Add field
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_32px] items-end">
                <Input value={field.label} onChange={(event) => setFields(fields.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry)))} placeholder="Label" />
                <Input value={field.key} onChange={(event) => setFields(fields.map((entry, i) => (i === index ? { ...entry, key: event.target.value } : entry)))} placeholder="field_key" />
                <Select value={field.type} onValueChange={(value) => setFields(fields.map((entry, i) => (i === index ? { ...entry, type: value } : entry)))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.toLowerCase().replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setFields(fields.filter((_, i) => i !== index))}
                  aria-label="Remove field"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.name || !form.key}>
              Create form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(active)} onOpenChange={() => setActive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{active?.name}</DialogTitle>
            <DialogDescription>{active?.description}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5">
            {(active?.fields ?? []).map((field) => (
              <li key={field.key} className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-2.5 py-1.5 text-sm">
                <span>{field.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {field.type.toLowerCase()} · {field.key}
                  {field.required ? " · required" : ""}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setActive(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
