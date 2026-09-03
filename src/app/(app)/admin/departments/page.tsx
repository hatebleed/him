"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";

type Department = { id: string; name: string; code: string; description: string | null; active: boolean; parentId: string | null };

export default function AdminDepartmentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", code: "", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: () => api.get<{ rows: Department[] }>("/api/admin/departments"),
  });

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/departments", form),
    onSuccess: async () => {
      await invalidate();
      setOpen(false);
      setForm({ name: "", code: "", description: "" });
      toast.success("Department created");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = useMutation({
    mutationFn: (payload: { id: string; active: boolean }) => api.patch(`/api/admin/departments/${payload.id}`, { active: payload.active }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Department updated");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/departments/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Department deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Departments"
        description="Organisational units used for assignment, filtering and reporting."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            New department
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
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((department) => (
              <li key={department.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {department.name}
                    <Badge variant="muted">{department.code}</Badge>
                    {!department.active ? <Badge variant="muted">inactive</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{department.description}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: department.id, active: !department.active })}>
                  {department.active ? "Deactivate" : "Activate"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(department.id)} aria-label="Delete department">
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
            <DialogTitle>New department</DialogTitle>
            <DialogDescription>Departments appear in assignment pickers and filters.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Code</span>
              <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="OPS" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.name || !form.code}>
              Create department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
