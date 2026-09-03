"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Button, Card, FieldError, Input, Label } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";

export default function ProfileSettingsPage() {
  const { user, roles, data } = useSession();
  // No password to change on a deployment that has no sign-in.
  const passwordAuth = (data?.security?.authMode ?? "password") === "password";
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [issue, setIssue] = React.useState<string | null>(null);

  const changePassword = useMutation({
    mutationFn: () => api.post("/api/auth/password", { currentPassword, newPassword }),
    onSuccess: async () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed. Other devices were signed out.");
    },
    onError: (error) => {
      setIssue(errorMessage(error));
      toast.error(errorMessage(error));
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setIssue(null);
    if (newPassword !== confirmPassword) {
      setIssue("The new passwords do not match.");
      return;
    }
    if (newPassword.length < 12) {
      setIssue("Use at least 12 characters for your new password.");
      return;
    }
    changePassword.mutate();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="My profile" description="Account details and security." />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Account</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Username</dt>
              <dd className="font-mono text-xs">{user?.username ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{user?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Job title</dt>
              <dd>{user?.jobTitle ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Badge</dt>
              <dd>{user?.badgeNumber ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Roles</dt>
              <dd>{roles.join(", ") || "—"}</dd>
            </div>
          </dl>
        </Card>

        {passwordAuth ? (
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Change password</h2>
            <form onSubmit={submit} className="space-y-3" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="current">Current password</Label>
                <Input id="current" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new">New password</Label>
                <Input id="new" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
              </div>
              {issue ? <FieldError>{issue}</FieldError> : null}
              <Button type="submit" loading={changePassword.isPending} disabled={!currentPassword || !newPassword}>
                Update password
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Passwords must be at least 12 characters and include upper and lower case letters and a number.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
