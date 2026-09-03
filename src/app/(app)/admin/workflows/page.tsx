"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, Input, Skeleton, Switch } from "@/components/ui/overlays-primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";
import { Label } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";

type Workflow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  resourceType: string;
  trigger: string;
  enabled: boolean;
  conditions: Array<{ id: string; field: string; operator: string; value: string | null; conjunction: string }>;
  actions: Array<{ id: string; type: string; config: Record<string, unknown> | null }>;
};

const TRIGGERS = ["RECORD_CREATED", "RECORD_UPDATED", "STATUS_CHANGED", "FORM_SUBMITTED", "REPORT_SUBMITTED", "USER_ASSIGNED"];
const ACTIONS = ["CHANGE_STATUS", "ASSIGN_USER", "ASSIGN_DEPARTMENT", "CREATE_TASK", "SEND_NOTIFICATION", "CREATE_TIMELINE_EVENT", "REQUIRE_APPROVAL"];

/** Workflow builder: trigger → conditions → actions, executed by the engine. */
export default function AdminWorkflowsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    key: "",
    name: "",
    description: "",
    resourceType: "incident",
    trigger: "RECORD_CREATED",
    conditionField: "",
    conditionOperator: "EQUALS",
    conditionValue: "",
    actionType: "CREATE_TASK",
    actionTitle: "",
    actionMessage: "",
    actionStatus: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "workflows"],
    queryFn: () => api.get<{ rows: Workflow[] }>("/api/admin/workflows"),
  });

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["admin", "workflows"] });

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/admin/workflows", {
        key: form.key || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        name: form.name,
        description: form.description || null,
        resourceType: form.resourceType,
        trigger: form.trigger,
        enabled: true,
        conditions: form.conditionField
          ? [{ field: form.conditionField, operator: form.conditionOperator, value: form.conditionValue, conjunction: "AND", sortOrder: 0 }]
          : [],
        actions: [
          {
            type: form.actionType,
            sortOrder: 0,
            config: {
              title: form.actionTitle || form.name,
              message: form.actionMessage || null,
              status: form.actionStatus || null,
              permission: "reports.approve",
              dueInDays: 1,
            },
          },
        ],
      }),
    onSuccess: async () => {
      await invalidate();
      setOpen(false);
      toast.success("Workflow created");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = useMutation({
    mutationFn: (payload: { id: string; enabled: boolean }) => api.patch(`/api/admin/workflows/${payload.id}`, { enabled: payload.enabled }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Workflow updated");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/workflows/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Workflow deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Workflows"
        description="Automate status changes, tasks and notifications when records change."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            New workflow
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No workflows configured.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((workflow) => (
              <li key={workflow.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {workflow.name}
                    <Badge variant="muted">{workflow.resourceType}</Badge>
                    <Badge variant="info">{workflow.trigger.toLowerCase().replace(/_/g, " ")}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {workflow.conditions.length
                      ? `When ${workflow.conditions[0]!.field} ${workflow.conditions[0]!.operator.toLowerCase()} ${workflow.conditions[0]!.value}`
                      : "Always"}
                    {workflow.actions.length ? ` → ${workflow.actions.map((action) => action.type.toLowerCase().replace(/_/g, " ")).join(", ")}` : ""}
                  </p>
                </div>
                <Switch
                  checked={workflow.enabled}
                  onCheckedChange={(checked: boolean) => toggle.mutate({ id: workflow.id, enabled: checked })}
                  aria-label="Workflow enabled"
                />
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(workflow.id)} aria-label="Delete workflow">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
            <DialogDescription>Workflows run server-side and their execution is written to the audit trail.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Key</span>
              <Input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="high_priority_escalation" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Record type</span>
              <Select value={form.resourceType} onValueChange={(value) => setForm({ ...form, resourceType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["incident", "case", "report", "task", "person", "vehicle", "evidence", "call"].map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Trigger</span>
              <Select value={form.trigger} onValueChange={(value) => setForm({ ...form, trigger: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger} value={trigger}>
                      {trigger.toLowerCase().replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Condition (optional)</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_1fr]">
                <Input value={form.conditionField} onChange={(event) => setForm({ ...form, conditionField: event.target.value })} placeholder="field (e.g. priority)" />
                <Select value={form.conditionOperator} onValueChange={(value) => setForm({ ...form, conditionOperator: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["EQUALS", "NOT_EQUALS", "CONTAINS", "GREATER_THAN", "LESS_THAN", "EXISTS", "IN"].map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator.toLowerCase().replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={form.conditionValue} onChange={(event) => setForm({ ...form, conditionValue: event.target.value })} placeholder="value" />
              </div>
            </div>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Action</span>
              <Select value={form.actionType} onValueChange={(value) => setForm({ ...form, actionType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.toLowerCase().replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Title / status</span>
              <Input value={form.actionTitle} onChange={(event) => setForm({ ...form, actionTitle: event.target.value })} placeholder="Review required" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Message</span>
              <Input value={form.actionMessage} onChange={(event) => setForm({ ...form, actionMessage: event.target.value })} />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.name}>
              Create workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
