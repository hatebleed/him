"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Card, Skeleton } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";

const CATEGORIES = ["REPORTS", "TASKS", "ALERTS", "WORKFLOWS", "ASSIGNMENTS", "MESSAGES", "DISPATCH", "SYSTEM"];

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.get<{ rows: Array<{ id: string; category: string; inApp: boolean; email: boolean }> }>("/api/notifications/preferences"),
  });

  const save = useMutation({
    mutationFn: (payload: { category: string; inApp?: boolean; email?: boolean }) => api.put("/api/notifications/preferences", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Preference saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Notification preferences" description="Control which categories reach you and how." />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {CATEGORIES.map((category) => {
              const row = (data?.rows ?? []).find((entry) => entry.category === category);
              return (
                <li key={category} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm capitalize">{category.toLowerCase()}</span>
                  <div className="flex items-center gap-5">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      In-app
                      <Switch
                        checked={row?.inApp ?? true}
                        onCheckedChange={(checked: boolean) => save.mutate({ category, inApp: checked })}
                        aria-label={`${category} in-app`}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Email
                      <Switch
                        checked={row?.email ?? false}
                        onCheckedChange={(checked: boolean) => save.mutate({ category, email: checked })}
                        aria-label={`${category} email`}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Email delivery uses the configured notification provider. In-app delivery is always available.
      </p>
    </div>
  );
}
