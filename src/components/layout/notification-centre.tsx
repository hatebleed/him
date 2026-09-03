"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, CheckCheck, Inbox } from "lucide-react";

import { api, errorMessage } from "@/lib/api/client";
import { formatRelative } from "@/lib/utils";
import { Button, EmptyState, Spinner } from "@/components/ui/primitives";
import { toast } from "sonner";
import { RecordIcon } from "@/components/icon";

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
  channel: "/communications",
};

/** Notification centre: list, read state and navigation to the source record. */
export function NotificationList({ onChanged }: { onChanged?: () => Promise<unknown> }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ rows: NotificationRow[]; unread: number }>("/api/notifications", { limit: 20 }),
    refetchInterval: 45_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await onChanged?.();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const markAll = useMutation({
    mutationFn: () => api.post("/api/notifications/read-all", {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await onChanged?.();
      toast.success("All notifications marked as read");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function open(notification: NotificationRow) {
    if (!notification.readAt) markRead.mutate(notification.id);
    const base = notification.resourceType ? HREF[notification.resourceType] : null;
    if (base && notification.resourceId) router.push(`${base}/${notification.resourceId}`);
  }

  return (
    <div className="flex max-h-[26rem] flex-col">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Notifications</p>
          {data?.unread ? <span className="rounded-full bg-primary/15 px-1.5 text-[11px] font-medium text-primary">{data.unread} new</span> : null}
        </div>
        {data?.unread ? (
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck />
            Mark all read
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : !data?.rows.length ? (
          <EmptyState icon={<BellOff className="h-5 w-5" />} title="Nothing new" description="Notifications appear here when records you can see change." />
        ) : (
          <ul className="divide-y divide-border/60">
            {data.rows.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => open(notification)}
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 ${
                    notification.readAt ? "opacity-70" : ""
                  }`}
                >
                  <span className="mt-0.5 rounded-md border border-border bg-secondary/60 p-1.5 text-muted-foreground">
                    <RecordIcon type={notification.resourceType ?? "system"} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`truncate text-sm ${notification.readAt ? "font-normal" : "font-medium"}`}>{notification.title}</span>
                      {notification.priority === "HIGH" ? <span className="h-1.5 w-1.5 rounded-full bg-warning" /> : null}
                    </span>
                    {notification.message ? (
                      <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{notification.message}</span>
                    ) : null}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{formatRelative(new Date(notification.createdAt))}</span>
                  </span>
                  {!notification.readAt ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border/70 px-3 py-2">
        <Button variant="ghost" size="sm" className="w-full" onClick={() => router.push("/notifications")}>
          <Inbox />
          View all notifications
        </Button>
      </div>
    </div>
  );
}
