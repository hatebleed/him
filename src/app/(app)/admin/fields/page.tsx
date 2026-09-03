"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";
import { Label } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";

type CustomField = {
  id: string;
  resourceType: string;
  key: string;
  label: string;
  type: string;
  section: string | null;
  required: boolean;
  showInList: boolean;
  active: boolean;
  options?: Array<{ label: string; value: string }> | null;
  conditions?: Array<{ field: string; operator: string; value: string }> | null;
  sortOrder: number;
};

const RESOURCE_TYPES = ["person", "vehicle", "incident", "case", "report", "task", "evidence", "unit", "call", "warrant", "alert", "bolo"];
const FIELD_TYPES = ["TEXT", "TEXTAREA", "NUMBER", "CURRENCY", "DATE", "DATETIME", "SELECT", "MULTI_SELECT", "CHECKBOX", "RADIO", "URL", "EMAIL", "PHONE", "USER"];

/**
 * Custom field builder: add fields to any record type without a migration.
 * Values are validated server-side on every write.
 */
export default function AdminFieldsPage() {
  const queryClient = useQueryClient();
  const [resourceType, setResourceType] = React.useState("incident");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    key: "",
    label: "",
    type: "TEXT",
    section: "",
    helpText: "",
    required: false,
    showInList: false,
    options: "",
    conditionField: "",
    conditionOperator: "EQUALS",
    conditionValue: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "fields", resourceType],
    queryFn: () => api.get<{ rows: CustomField[] }>("/api/admin/fields", { resourceType }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "fields"] });
    await queryClient.invalidateQueries({ queryKey: ["session", "shell"] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/admin/fields", {
        resourceType,
        key: form.key || form.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label: form.label,
        type: form.type,
        section: form.section || null,
        helpText: form.helpText || null,
        required: form.required,
        showInList: form.showInList,
        options: form.options
          ? form.options.split(",").map((option) => ({ label: option.trim(), value: option.trim().toUpperCase().replace(/\s+/g, "_") }))
          : null,
        conditions: form.conditionField
          ? [{ field: form.conditionField, operator: form.conditionOperator, value: form.conditionValue }]
          : null,
      }),
    onSuccess: async () => {
      await invalidate();
      setOpen(false);
      setForm({ key: "", label: "", type: "TEXT", section: "", helpText: "", required: false, showInList: false, options: "", conditionField: "", conditionOperator: "EQUALS", conditionValue: "" });
      toast.success("Custom field created");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = useMutation({
    mutationFn: (payload: { id: string; active: boolean }) => api.patch(`/api/admin/fields/${payload.id}`, { active: payload.active }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Field updated");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/fields/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Field deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Custom fields"
        description="Add fields to any record type. No schema migration is required and values are validated on the server."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            Add field
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
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
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No custom fields" description={`Add fields to ${resourceType} records to capture the data your organisation needs.`} />
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((field) => (
              <li key={field.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {field.label}
                    <Badge variant="muted">{field.type.toLowerCase()}</Badge>
                    {field.required ? <Badge variant="warning">required</Badge> : null}
                    {field.showInList ? <Badge variant="info">in list</Badge> : null}
                    {!field.active ? <Badge variant="muted">disabled</Badge> : null}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {field.key}
                    {field.section ? ` · ${field.section}` : ""}
                    {field.conditions?.length ? ` · shown when ${field.conditions[0]!.field} ${field.conditions[0]!.operator.toLowerCase()} ${field.conditions[0]!.value}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: field.id, active: !field.active })}>
                  {field.active ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(field.id)} aria-label="Delete field">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a custom field</DialogTitle>
            <DialogDescription>The field appears on create, edit and detail views for this record type.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Label</span>
              <Input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Supervisor approval reference" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Key (optional)</span>
              <Input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="approval_ref" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.toLowerCase().replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Section</span>
              <Input value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} placeholder="Governance" />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Help text</span>
              <Input value={form.helpText} onChange={(event) => setForm({ ...form, helpText: event.target.value })} />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Options (comma separated, for select/radio)</span>
              <Input value={form.options} onChange={(event) => setForm({ ...form, options: event.target.value })} placeholder="Yes, No, Unknown" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Show when field</span>
              <Input value={form.conditionField} onChange={(event) => setForm({ ...form, conditionField: event.target.value })} placeholder="priority" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">…equals</span>
              <Input value={form.conditionValue} onChange={(event) => setForm({ ...form, conditionValue: event.target.value })} placeholder="HIGH" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.required} onChange={(event) => setForm({ ...form, required: event.target.checked })} />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.showInList} onChange={(event) => setForm({ ...form, showInList: event.target.checked })} />
              Show in list view
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.label.trim()}>
              Create field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
