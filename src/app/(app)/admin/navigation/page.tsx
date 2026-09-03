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

type NavRow = { key: string; label: string; href: string | null; icon: string | null; moduleKey: string | null; permission: string | null; group: string; sortOrder: number; enabled: boolean };

/** Navigation editor: rename, regroup, reorder and hide menu items. */
export default function AdminNavigationPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ key: "", label: "", href: "", icon: "", group: "main", permission: "", sortOrder: 100 });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "navigation"],
    queryFn: () => api.get<{ rows: NavRow[] }>("/api/admin/navigation"),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "navigation"] });
    await queryClient.invalidateQueries({ queryKey: ["session", "shell"] });
  };

  const toggle = useMutation({
    mutationFn: (payload: { key: string; enabled: boolean }) => api.patch("/api/admin/navigation", payload),
    onSuccess: async () => {
      await invalidate();
      toast.success("Navigation updated");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const save = useMutation({
    mutationFn: () => api.put("/api/admin/navigation", { ...form, icon: form.icon || null, permission: form.permission || null, enabled: true }),
    onSuccess: async () => {
      await invalidate();
      setOpen(false);
      toast.success("Navigation item saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (key: string) => api.delete(`/api/admin/navigation?key=${key}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Navigation item deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = (data?.rows ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Navigation"
        description="Control the sidebar: labels, grouping, ordering and visibility."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            Add item
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {item.label}
                    <Badge variant="muted">{item.group}</Badge>
                    {item.permission ? <Badge variant="info">{item.permission}</Badge> : null}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {item.href ?? "—"} · {item.icon ?? "no icon"}
                  </p>
                </div>
                <Switch
                  checked={item.enabled}
                  onCheckedChange={(checked: boolean) => toggle.mutate({ key: item.key, enabled: checked })}
                  aria-label={`${item.label} visible`}
                />
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(item.key)} aria-label="Delete item">
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
            <DialogTitle>Add a navigation item</DialogTitle>
            <DialogDescription>Use the icon name from Lucide (for example, FileText).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Label</span>
              <Input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Key</span>
              <Input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="nav.incidents" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Path</span>
              <Input value={form.href} onChange={(event) => setForm({ ...form, href: event.target.value })} placeholder="/incidents" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Icon</span>
              <Input value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} placeholder="FileText" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Group</span>
              <Input value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Permission (optional)</span>
              <Input value={form.permission} onChange={(event) => setForm({ ...form, permission: event.target.value })} placeholder="incidents.view" />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <Label>Sort order</Label>
              <Input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.label || !form.key || !form.href}>
              Save item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
