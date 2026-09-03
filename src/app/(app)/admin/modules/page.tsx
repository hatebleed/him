"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Card, Skeleton, Switch } from "@/components/ui/overlays-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { dynamicIcon } from "@/components/icon";

type ModuleRow = {
  key: string;
  name: string;
  description: string;
  icon: string;
  href: string;
  group: string;
  sortOrder: number;
  enabled: boolean;
  core?: boolean;
};

/** Enable and disable modules - navigation and routes follow immediately. */
export default function AdminModulesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "modules"],
    queryFn: () => api.get<{ rows: ModuleRow[] }>("/api/admin/modules"),
  });

  const toggle = useMutation({
    mutationFn: (payload: { key: string; enabled: boolean }) => api.patch("/api/admin/modules", payload),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "modules"] });
      await queryClient.invalidateQueries({ queryKey: ["session", "shell"] });
      toast.success(`Module ${variables.enabled ? "enabled" : "disabled"}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];
  const groups = rows.reduce<Record<string, ModuleRow[]>>((acc, row) => {
    acc[row.group] = acc[row.group] ?? [];
    acc[row.group]!.push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <PageHeader
        title="Modules"
        description="Disabled modules disappear from navigation and their routes refuse to serve data."
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        Object.entries(groups).map(([group, items]) => (
          <Card key={group}>
            <div className="border-b border-border/60 px-4 py-2.5">
              <p className="text-sm font-semibold capitalize">{group}</p>
            </div>
            <ul className="divide-y divide-border/60">
              {items.map((module) => {
                const Icon = dynamicIcon(module.icon);
                return (
                  <li key={module.key} className="flex items-center gap-3 px-4 py-3">
                    <span className="rounded-md border border-border bg-secondary/50 p-1.5 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
                      <Icon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {module.name}
                        {module.core ? <Badge variant="muted">core</Badge> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{module.description}</p>
                    </div>
                    <Switch
                      checked={module.enabled}
                      disabled={module.core || toggle.isPending}
                      onCheckedChange={(checked: boolean) => toggle.mutate({ key: module.key, enabled: checked })}
                      aria-label={`${module.name} enabled`}
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}

      <p className="text-xs text-muted-foreground">
        Core modules (dashboard, search, administration) keep the application usable and cannot be disabled.
      </p>
    </div>
  );
}

