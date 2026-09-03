"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";
import { UserPicker } from "@/components/forms/pickers";

type UnitRow = { id: string; name: string; callsign: string; status: string; departmentName: string | null; vehicleRegistration: string | null; personnel: Array<{ id: string; name: string }> };

/** Unit administration: create units and assign personnel. */
export default function AdminUnitsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", callsign: "", memberIds: [] as string[] });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "units"],
    queryFn: () => api.get<{ rows: UnitRow[]; total: number }>("/api/units", { pageSize: 100 }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "units"] });
    await queryClient.invalidateQueries({ queryKey: ["units"] });
  };

  const create = useMutation({
    mutationFn: () => api.post("/api/units", { ...form, status: "AVAILABLE" }),
    onSuccess: async () => {
      await invalidate();
      setOpen(false);
      setForm({ name: "", callsign: "", memberIds: [] });
      toast.success("Unit created");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/units/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Unit deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Units"
        description="Create units and assign the people who work in them."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            New unit
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((unit) => (
              <li key={unit.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {unit.callsign}
                    <Badge variant="muted">{unit.name}</Badge>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {unit.departmentName ?? "No department"} · {unit.vehicleRegistration ?? "no vehicle"} · {unit.personnel.map((member) => member.name).join(", ") || "no personnel"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(unit.id)} aria-label="Delete unit">
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
            <DialogTitle>New unit</DialogTitle>
            <DialogDescription>Units appear on the dispatch board immediately.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Unit 1" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Callsign</span>
              <Input value={form.callsign} onChange={(event) => setForm({ ...form, callsign: event.target.value.toUpperCase() })} placeholder="A12" />
            </label>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Personnel</span>
              <div className="space-y-2">
                {form.memberIds.map((memberId, index) => (
                  <UserPicker
                    key={index}
                    value={memberId}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        memberIds: form.memberIds.map((entry, i) => (i === index ? value ?? "" : entry)).filter(Boolean),
                      })
                    }
                  />
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setForm({ ...form, memberIds: [...form.memberIds, ""] })}
                >
                  <Plus />
                  Add member
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.name || !form.callsign}>
              Create unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
