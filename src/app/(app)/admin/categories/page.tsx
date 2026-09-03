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

type CategoryRow = { id: string; resourceType: string; key: string; label: string; colour: string; icon: string | null; active: boolean; sortOrder: number };

const RESOURCE_TYPES = ["incident", "case", "report", "person", "vehicle", "evidence", "alert", "bolo"];

/** Category configuration used by records, reports and analytics grouping. */
export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [resourceType, setResourceType] = React.useState("incident");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ key: "", label: "", colour: "#64748b", icon: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "categories", resourceType],
    queryFn: () => api.get<{ rows: CategoryRow[] }>("/api/admin/categories", { resourceType }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    await queryClient.invalidateQueries({ queryKey: ["session", "shell"] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/admin/categories", { resourceType, key: form.key.toUpperCase(), label: form.label, colour: form.colour, icon: form.icon || null }),
    onSuccess: async () => {
      await invalidate();
      setOpen(false);
      setForm({ key: "", label: "", colour: "#64748b", icon: "" });
      toast.success("Category created");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/categories/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Category deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categories"
        description="Categories classify records and group analytics."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            Add category
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
            {rows.map((category) => (
              <li key={category.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.colour }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {category.label}
                    <span className="font-mono text-xs text-muted-foreground">{category.key}</span>
                    {!category.active ? <Badge variant="muted">disabled</Badge> : null}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(category.id)} aria-label="Delete category">
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
            <DialogTitle>Add a category</DialogTitle>
            <DialogDescription>Categories are available immediately on {resourceType} records.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Label</span>
              <Input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Key</span>
              <Input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value.toUpperCase() })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Colour</span>
              <Input type="color" value={form.colour} onChange={(event) => setForm({ ...form, colour: event.target.value })} className="h-9" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Icon (Lucide name)</span>
              <Input value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} placeholder="AlertTriangle" />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.label || !form.key}>
              Create category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
