"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Button, Card, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { PageHeader } from "@/components/layout/page-header";

type Setting = { key: string; value: unknown; description: string | null };

/** Key/value system settings, editable without redeploying. */
export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get<{ rows: Setting[] }>("/api/admin/settings"),
  });

  React.useEffect(() => {
    if (data?.rows) {
      setDraft(Object.fromEntries(data.rows.map((row) => [row.key, typeof row.value === "object" ? JSON.stringify(row.value) : String(row.value)])));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: { key: string; value: unknown; description?: string }) => api.put("/api/admin/settings", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Setting saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Platform-wide settings stored in the database." />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No settings stored yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((setting) => (
              <li key={setting.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted-foreground">{setting.key}</p>
                  <p className="text-xs text-muted-foreground">{setting.description}</p>
                </div>
                <Input
                  value={draft[setting.key] ?? ""}
                  onChange={(event) => setDraft({ ...draft, [setting.key]: event.target.value })}
                  className="h-8 w-56"
                  aria-label={setting.key}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const raw = draft[setting.key] ?? "";
                    let value: unknown = raw;
                    if (raw === "true" || raw === "false") value = raw === "true";
                    else if (raw !== "" && !Number.isNaN(Number(raw))) value = Number(raw);
                    save.mutate({ key: setting.key, value, description: setting.description ?? undefined });
                  }}
                >
                  <Save />
                  Save
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
