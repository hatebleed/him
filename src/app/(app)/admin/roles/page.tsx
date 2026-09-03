"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, Input, Skeleton, Switch } from "@/components/ui/overlays-primitives";
import { PageHeader } from "@/components/layout/page-header";

type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
};

type Catalogue = {
  catalogue: Array<{ key: string; resource: string; action: string; category: string; description: string }>;
};

/**
 * Role and permission editor.
 * Permissions are grouped by category and saved as a complete set; the server
 * refuses changes that would leave the platform without a role able to manage
 * roles.
 */
export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [activeRole, setActiveRole] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState("");

  const { data: roles, isLoading } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api.get<{ rows: Role[] }>("/api/admin/roles"),
  });

  const { data: permissions } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => api.get<Catalogue>("/api/admin/permissions"),
  });

  const rows = roles?.rows ?? [];
  const role = rows.find((entry) => entry.id === activeRole) ?? rows[0] ?? null;

  // Intentionally keyed on the role id only: switching roles must reset the
  // draft, but typing in the permission list must not.
  React.useEffect(() => {
    if (role) setDraft(new Set(role.permissions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role?.id]);

  const save = useMutation({
    mutationFn: () => api.patch(`/api/admin/roles/${role!.id}`, { permissionKeys: [...draft] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      await queryClient.invalidateQueries({ queryKey: ["session", "shell"] });
      toast.success("Role permissions saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const catalogue = (permissions?.catalogue ?? []).filter(
    (permission) =>
      !search.trim() ||
      permission.key.toLowerCase().includes(search.toLowerCase()) ||
      permission.description.toLowerCase().includes(search.toLowerCase()),
  );

  const grouped = catalogue.reduce<Record<string, typeof catalogue>>((acc, permission) => {
    acc[permission.category] = acc[permission.category] ?? [];
    acc[permission.category]!.push(permission);
    return acc;
  }, {});

  const dirty = role ? draft.size !== role.permissions.length || [...draft].some((key) => !role.permissions.includes(key)) : false;

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Roles & permissions"
        description="Permissions use resource.action semantics and are enforced on the server on every request."
        actions={
          role ? (
            <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
              <Save />
              Save changes
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        <Card className="p-2">
          <ul className="space-y-0.5">
            {rows.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setActiveRole(entry.id)}
                  className={`w-full rounded-md px-2.5 py-2 text-left transition-colors ${
                    (role?.id ?? rows[0]?.id) === entry.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {entry.name}
                    {entry.isSystem ? <Badge variant="muted">system</Badge> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {entry.permissions.length} permissions · {entry.memberCount} users
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          {!role ? (
            <p className="p-6 text-sm text-muted-foreground">Select a role to edit its permissions.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter permissions…"
                  className="h-8 w-56"
                  aria-label="Filter permissions"
                />
              </div>

              <div className="max-h-[32rem] space-y-5 overflow-y-auto p-4">
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            const next = new Set(draft);
                            items.forEach((item) => next.add(item.key));
                            setDraft(next);
                          }}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            const next = new Set(draft);
                            items.forEach((item) => next.delete(item.key));
                            setDraft(next);
                          }}
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((permission) => (
                        <label key={permission.key} className="flex items-start gap-2.5 rounded-md border border-border/60 px-2.5 py-2">
                          <Switch
                            checked={draft.has(permission.key)}
                            onCheckedChange={(checked: boolean) => {
                              const next = new Set(draft);
                              if (checked) next.add(permission.key);
                              else next.delete(permission.key);
                              setDraft(next);
                            }}
                            aria-label={permission.key}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-xs">{permission.key}</span>
                            <span className="block text-xs text-muted-foreground">{permission.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
