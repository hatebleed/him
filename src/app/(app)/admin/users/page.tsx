"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldOff, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Input} from "@/components/ui/overlays-primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { useListQuery } from "@/lib/hooks/use-list-query";
import { formatRelative } from "@/lib/utils";

type UserRow = {
  id: string;
  name: string;
  email: string;
  username: string;
  jobTitle: string | null;
  badgeNumber: string | null;
  status: string;
  departmentName: string | null;
  lastLoginAt: string | null;
  roles: Array<{ key: string; name: string }>;
  lockedUntil: string | null;
};

type RoleOption = { id: string; key: string; name: string };

/** User administration: create, edit, reset passwords and revoke sessions. */
export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { query, setQuery, apiParams } = useListQuery({ pageSize: 25 });
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", username: "", password: "", jobTitle: "", badgeNumber: "", roleIds: [] as string[] });
  const [resetResult, setResetResult] = React.useState<{ username: string; password: string } | null>(null);

  const { data, isFetching, error } = useQuery({
    queryKey: ["admin", "users", apiParams],
    queryFn: () => api.get<{ rows: UserRow[]; total: number; page: number; pageSize: number; pageCount: number }>("/api/admin/users", apiParams),
    placeholderData: (previous) => previous,
  });

  const { data: roles } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api.get<{ rows: Array<RoleOption & { permissions: string[]; memberCount: number }> }>("/api/admin/roles"),
  });

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const create = useMutation({
    mutationFn: () => api.post<{ user: UserRow; temporaryPassword: string | null }>("/api/admin/users", form),
    onSuccess: async (result) => {
      await invalidate();
      setOpen(false);
      setForm({ name: "", email: "", username: "", password: "", jobTitle: "", badgeNumber: "", roleIds: [] });
      if (result.temporaryPassword) setResetResult({ username: result.user.username, password: result.temporaryPassword });
      toast.success("User created");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) => api.post<{ temporaryPassword: string | null }>(`/api/admin/users/${id}/password`, {}),
    onSuccess: async (result, id) => {
      const user = data?.rows.find((row) => row.id === id);
      if (result.temporaryPassword && user) setResetResult({ username: user.username, password: result.temporaryPassword });
      toast.success("Password reset");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const setStatus = useMutation({
    mutationFn: (payload: { id: string; status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" }) =>
      api.patch(`/api/admin/users/${payload.id}`, { status: payload.status }),
    onSuccess: async () => {
      await invalidate();
      toast.success("User updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}/sessions`),
    onSuccess: async () => {
      toast.success("Sessions revoked");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const columns = React.useMemo<Array<DataTableColumn<UserRow>>>(
    () => [
      {
        key: "name",
        header: "User",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        ),
      },
      {
        key: "roles",
        header: "Roles",
        cell: (row) => (
          <span className="flex flex-wrap gap-1">
            {row.roles.map((role) => (
              <Badge key={role.key} variant="muted">
                {role.name}
              </Badge>
            ))}
          </span>
        ),
      },
      { key: "departmentName", header: "Department", secondary: true, cell: (row) => <span className="truncate">{row.departmentName ?? "—"}</span> },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cell: (row) => (
          <Badge variant={row.status === "ACTIVE" ? "success" : row.status === "SUSPENDED" ? "warning" : "muted"}>
            {row.status.toLowerCase()}
          </Badge>
        ),
      },
      {
        key: "lastLoginAt",
        header: "Last sign-in",
        sortable: true,
        cell: (row) => <span className="text-xs text-muted-foreground">{row.lastLoginAt ? formatRelative(new Date(row.lastLoginAt)) : "never"}</span>,
      },
      {
        key: "actions",
        header: "Actions",
        align: "right",
        cell: (row) => (
          <span className="flex justify-end gap-1">
            {row.status === "ACTIVE" ? (
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: row.id, status: "SUSPENDED" })} aria-label="Suspend user">
                <ShieldOff />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: row.id, status: "ACTIVE" })}>
                Activate
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => resetPassword.mutate(row.id)} aria-label="Reset password">
              <KeyRound />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => revoke.mutate(row.id)}>
              Sign out
            </Button>
          </span>
        ),
      },
    ],
    [revoke, resetPassword, setStatus],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Create accounts, assign roles and control access."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <UserPlus />
            New user
          </Button>
        }
      />

      <DataTable<UserRow>
        rows={data?.rows ?? []}
        meta={data ? { total: data.total, page: data.page, pageSize: data.pageSize, pageCount: data.pageCount } : undefined}
        columns={columns}
        query={query}
        onQueryChange={setQuery}
        loading={isFetching}
        error={error as Error | null}
        searchPlaceholder="Search name, email, username or badge…"
        rowHref={(row) => `/admin/users/${row.id}`}
        emptyTitle="No users found"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a user</DialogTitle>
            <DialogDescription>Leave the password blank to generate a temporary one.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Full name</span>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Username</span>
              <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Password (optional)</span>
              <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Job title</span>
              <Input value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Badge number</span>
              <Input value={form.badgeNumber} onChange={(event) => setForm({ ...form, badgeNumber: event.target.value })} />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Roles</span>
              <div className="flex flex-wrap gap-2">
                {(roles?.rows ?? []).map((role) => {
                  const active = form.roleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, roleIds: active ? form.roleIds.filter((id) => id !== role.id) : [...form.roleIds, role.id] })
                      }
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.name || !form.email || !form.username}>
              Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetResult)} onOpenChange={() => setResetResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>Share this with the user securely. They must change it at next sign-in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">User:</span> <span className="font-mono">{resetResult?.username}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Password:</span> <span className="font-mono">{resetResult?.password}</span>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

