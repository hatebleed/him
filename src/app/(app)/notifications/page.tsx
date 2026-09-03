"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";
import { RecordIcon } from "@/components/icon";
import { formatRelative } from "@/lib/utils";

type NotificationRow = {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  message: string | null;
  resourceType: string | null;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
};

const HREF: Record<string, string> = {
  incident: "/incidents",
  person: "/people",
  vehicle: "/vehicles",
  report: "/reports",
  task: "/tasks",
  alert: "/alerts",
  bolo: "/bolos",
  evidence: "/evidence",
  case: "/cases",
  unit: "/units",
  call: "/dispatch",
};

const CATEGORIES = ["REPORTS", "TASKS", "ALERTS", "WORKFLOWS", "ASSIGNMENTS", "MESSAGES", "DISPATCH", "SYSTEM"];

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", unreadOnly],
    queryFn: () => api.get<{ rows: NotificationRow[]; unread: number }>("/api/notifications", { limit: 60, unread: String(unreadOnly) }),
    refetchInterval: 45_000,
  });

  const { data: preferences } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.get<{ rows: Array<{ id: string; category: string; inApp: boolean; email: boolean }> }>("/api/notifications/preferences"),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["session", "shell"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const markAll = useMutation({
    mutationFn: () => api.post("/api/notifications/read-all", {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["session", "shell"] });
      toast.success("All notifications marked as read");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const setPreference = useMutation({
    mutationFn: (payload: { category: string; inApp: boolean }) => api.put("/api/notifications/preferences", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Preference saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Everything raised for you by records, workflows and colleagues."
        actions={
          data?.unread ? (
            <Button size="sm" variant="outline" onClick={() => markAll.mutate()} loading={markAll.isPending}>
              <CheckCheck />
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            <p className="text-sm font-semibold">Recent</p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Unread only
              <Switch checked={unreadOnly} onCheckedChange={(checked: boolean) => setUnreadOnly(checked)} />
            </label>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<BellOff className="h-5 w-5" />} title="Nothing here" description="You have no notifications matching this view." />
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((notification) => {
                const base = notification.resourceType ? HREF[notification.resourceType] : null;
                return (
                  <li key={notification.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 rounded-md border border-border bg-secondary/50 p-1.5 text-muted-foreground">
                      <RecordIcon type={notification.resourceType ?? "system"} className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        if (!notification.readAt) markRead.mutate(notification.id);
                        if (base && notification.resourceId) router.push(`${base}/${notification.resourceId}`);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-sm ${notification.readAt ? "font-normal" : "font-medium"}`}>{notification.title}</span>
                        {notification.priority === "HIGH" ? <Badge variant="warning">high</Badge> : null}
                      </span>
                      {notification.message ? <span className="mt-0.5 block text-sm text-muted-foreground">{notification.message}</span> : null}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {notification.category.toLowerCase()} · {formatRelative(new Date(notification.createdAt))}
                      </span>
                    </button>
                    {!notification.readAt ? (
                      <Button size="sm" variant="ghost" onClick={() => markRead.mutate(notification.id)}>
                        Mark read
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="border-b border-border/60 px-4 py-2.5">
            <p className="text-sm font-semibold">Preferences</p>
            <p className="text-xs text-muted-foreground">Choose which categories reach you in-app.</p>
          </div>
          <ul className="divide-y divide-border/60">
            {CATEGORIES.map((category) => {
              const existing = (preferences?.rows ?? []).find((row) => row.category === category);
              const enabled = existing?.inApp ?? true;
              return (
                <li key={category} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-sm capitalize">{category.toLowerCase()}</span>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked: boolean) => setPreference.mutate({ category, inApp: checked })}
                    aria-label={`${category} notifications`}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
