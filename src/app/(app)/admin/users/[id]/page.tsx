"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { PageHeader, DetailGrid} from "@/components/layout/page-header";
import { formatDateTime, formatRelative } from "@/lib/utils";

type UserDetail = {
  id: string;
  name: string;
  email: string;
  username: string;
  jobTitle: string | null;
  badgeNumber: string | null;
  phone: string | null;
  status: string;
  departmentName: string | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  failedLogins: number;
  lockedUntil: string | null;
  roles: Array<{ id: string; key: string; name: string }>;
  sessions: Array<{ id: string; createdAt: string; lastUsedAt: string | null; ip: string | null; userAgent: string | null; revokedAt: string | null }>;
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [badgeNumber, setBadgeNumber] = React.useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users", id],
    queryFn: () => api.get<UserDetail>(`/api/admin/users/${id}`),
    retry: false,
  });

  const { data: roles } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api.get<{ rows: Array<{ id: string; key: string; name: string; permissions: string[] }> }>("/api/admin/roles"),
  });

  // Loaded once per user: the form is the source of truth while editing.
  React.useEffect(() => {
    if (data) {
      setName(data.name);
      setJobTitle(data.jobTitle ?? "");
      setPhone(data.phone ?? "");
      setBadgeNumber(data.badgeNumber ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/api/admin/users/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users", id] });
      toast.success("User updated");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <p className="text-sm text-muted-foreground">This user could not be loaded.</p>;

  const activeSessions = data.sessions.filter((session) => !session.revokedAt);

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.name}
        description={`@${data.username} · ${data.email}`}
        actions={
          <>
            {data.status === "ACTIVE" ? (
              <Button size="sm" variant="outline" onClick={() => save.mutate({ status: "SUSPENDED" })}>
                Suspend
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => save.mutate({ status: "ACTIVE" })}>
                Activate
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => router.push("/admin/users")}>
              Back
            </Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Job title</span>
              <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Phone</span>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Badge number</span>
              <Input value={badgeNumber} onChange={(event) => setBadgeNumber(event.target.value)} />
            </label>
          </div>
          <Button className="mt-3" size="sm" onClick={() => save.mutate({ name, jobTitle, phone, badgeNumber })} loading={save.isPending}>
            Save changes
          </Button>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Roles</h2>
          <div className="space-y-1.5">
            {(roles?.rows ?? []).map((role) => {
              const assigned = data.roles.some((entry) => entry.id === role.id);
              return (
                <label key={role.id} className="flex items-center gap-2.5 rounded-md border border-border/60 px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={(event) =>
                      save.mutate({
                        roleIds: event.target.checked
                          ? [...data.roles.map((entry) => entry.id), role.id]
                          : data.roles.filter((entry) => entry.id !== role.id).map((entry) => entry.id),
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-sm">{role.name}</span>
                    <span className="block text-xs text-muted-foreground">{role.permissions.length} permissions</span>
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Account state</h2>
          <DetailGrid
            items={[
              { label: "Status", value: <Badge variant={data.status === "ACTIVE" ? "success" : "warning"}>{data.status.toLowerCase()}</Badge> },
              { label: "Created", value: formatDateTime(new Date(data.createdAt)) },
              { label: "Last sign-in", value: data.lastLoginAt ? formatRelative(new Date(data.lastLoginAt)) : "never" },
              { label: "Failed sign-ins", value: String(data.failedLogins) },
              { label: "Locked until", value: data.lockedUntil ? formatDateTime(new Date(data.lockedUntil)) : "not locked" },
              { label: "Multi-factor", value: data.mfaEnabled ? "Enabled" : "Not enabled" },
            ]}
          />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sessions ({activeSessions.length} active)</h2>
            <Button size="sm" variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "users", id] })}>
              Refresh
            </Button>
          </div>
          <ul className="space-y-2">
            {data.sessions.length === 0 ? (
              <li className="text-sm text-muted-foreground">No sessions recorded.</li>
            ) : (
              data.sessions.map((session) => (
                <li key={session.id} className="rounded-md border border-border/60 px-2.5 py-2 text-xs">
                  <p className="font-medium">{session.ip ?? "Unknown IP"}</p>
                  <p className="truncate text-muted-foreground">{session.userAgent ?? "Unknown device"}</p>
                  <p className="text-muted-foreground">
                    {formatRelative(new Date(session.lastUsedAt ?? session.createdAt))}
                    {session.revokedAt ? " · revoked" : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

