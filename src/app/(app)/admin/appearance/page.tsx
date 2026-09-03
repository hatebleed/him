"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Button, Card, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { useSession } from "@/components/providers/session-provider";

type Theme = { mode: string; accentColour: string; density: string; radius: string; sidebarStyle: string; fontFamily: string; motion: string };

export default function AdminAppearancePage() {
  const queryClient = useQueryClient();
  const { refresh } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "theme"],
    queryFn: () => api.get<Theme>("/api/admin/theme"),
  });

  const [form, setForm] = React.useState<Theme | null>(null);
  React.useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put("/api/admin/theme", form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "theme"] });
      await refresh();
      toast.success("Appearance saved for everyone");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading || !form) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Appearance"
        description="Interface theme applied to every user."
        actions={
          <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>
            Save appearance
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["mode", "Mode", ["dark", "light"]],
              ["density", "Density", ["compact", "comfortable", "spacious"]],
              ["sidebarStyle", "Sidebar style", ["default", "compact", "bordered"]],
              ["fontFamily", "Font", ["inter", "system", "mono"]],
              ["motion", "Motion", ["full", "reduced", "none"]],
            ] as const
          ).map(([field, label, options]) => (
            <label key={field} className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <Select value={String(form[field])} onValueChange={(value) => setForm({ ...form, [field]: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ))}

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Accent colour</span>
            <Input type="color" value={form.accentColour} onChange={(event) => setForm({ ...form, accentColour: event.target.value })} className="h-10" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Corner radius</span>
            <Input value={form.radius} onChange={(event) => setForm({ ...form, radius: event.target.value })} placeholder="0.6rem" />
          </label>
        </div>
      </Card>
    </div>
  );
}
