"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Button, Card, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { PageHeader } from "@/components/layout/page-header";

type Setting = { key: string; value: unknown; description: string | null };

/** Notification settings: retention window and delivery defaults. */
export default function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const [retention, setRetention] = React.useState("90");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get<{ rows: Setting[] }>("/api/admin/settings"),
  });

  React.useEffect(() => {
    const row = (data?.rows ?? []).find((entry) => entry.key === "notifications.retentionDays");
    if (row) setRetention(String(row.value));
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: { key: string; value: unknown; description?: string }) => api.put("/api/admin/settings", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Notification settings saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" description="Platform-wide notification behaviour." />

      <Card className="p-4">
        <div className="max-w-sm space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Retention (days)</span>
          <div className="flex gap-2">
            <Input value={retention} onChange={(event) => setRetention(event.target.value)} type="number" min={1} max={365} />
            <Button
              onClick={() => save.mutate({ key: "notifications.retentionDays", value: Number(retention), description: "Notification retention window." })}
              loading={save.isPending}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Notifications older than this are removed by the retention job. In-app delivery is always enabled; email delivery follows the configured provider.
          </p>
        </div>
      </Card>
    </div>
  );
}
