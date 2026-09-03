"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ExternalLink, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button, Card, CardContent, Input, Label } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api/client";
import { useSession } from "@/components/providers/session-provider";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sessionBlocked, setSessionBlocked] = React.useState(false);
  const next = params.get("next") ?? "/dashboard";
  const [framed, setFramed] = React.useState(false);

  // A page can only read window.top when it is not framed by another site, so
  // this doubles as an "embeddable context" probe.
  React.useEffect(() => {
    try {
      setFramed(window.self !== window.top);
    } catch {
      setFramed(true);
    }
  }, []);

  /** Opens the application top-level, where the session cookie is first-party. */
  function openInNewTab() {
    window.open(new URL(next, window.location.href).toString(), "_blank", "noopener");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/login", { identifier, password });
      await refresh();

      // The credentials were accepted, but the session only exists if the
      // browser actually kept the cookie. Browsers discard it silently when the
      // page is embedded on another site and the cookie is not
      // `SameSite=None; Secure` - verify instead of navigating into a redirect
      // back to this page.
      const shell = await api.get<{ user: unknown } | null>("/api/shell").catch(() => null);
      if (!shell?.user) {
        setSessionBlocked(true);
        setSubmitting(false);
        return;
      }

      toast.success("Signed in");
      router.replace(next);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
        <p className="text-sm text-muted-foreground">Use the account issued by your administrator.</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Username or email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="identifier"
                  name="identifier"
                  autoComplete="username"
                  className="pl-9"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="pl-9"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {sessionBlocked ? (
              <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>
                    Your credentials were accepted, but this browser did not keep the session cookie, so you were not
                    signed in. That happens when the application is displayed inside another site&apos;s frame and the
                    browser blocks cookies for it.
                  </span>
                </div>
                <Button type="button" variant="secondary" size="sm" className="w-full" onClick={openInNewTab}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open the application in a new tab
                </Button>
              </div>
            ) : null}

            <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border/70 bg-card/60 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Demonstration accounts</p>
        <p className="mt-1">Password for every seeded account: <code className="rounded bg-secondary px-1 py-0.5 text-foreground">DemoPass123!</code></p>
        <ul className="mt-2 space-y-0.5">
          <li><code className="text-foreground">admin</code> — full configuration access</li>
          <li><code className="text-foreground">supervisor1</code> — approvals and oversight</li>
          <li><code className="text-foreground">operator1</code> — record creation and dispatch</li>
          <li><code className="text-foreground">readonly</code> — view-only access</li>
        </ul>
        {framed ? (
          <p className="mt-3 border-t border-border/60 pt-2 text-muted-foreground">
            This page is running inside an embedded frame, where some browsers refuse cookies. If signing in does not
            work,{" "}
            <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={openInNewTab}>
              open it in a new tab
            </button>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
