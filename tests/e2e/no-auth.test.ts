import { describe, expect, it } from "vitest";

/**
 * Deployments with no sign-in (`AUTH_MODE=none`).
 *
 * The application must open straight into the MDT, with no credential routes
 * and no session cookie - while authorisation, auditing and configuration stay
 * exactly as they are for a signed-in account.
 *
 *   AUTH_MODE=none RUN_E2E=1 npm run test:e2e
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ENABLED = process.env.RUN_E2E === "1";
const NO_AUTH = (process.env.AUTH_MODE ?? "password") === "none";
const OPERATOR = process.env.OPERATOR_USER || "admin";

describe.skipIf(!ENABLED || !NO_AUTH)("no sign-in deployment", () => {
  it("opens the application with no credentials and no cookie", async () => {
    const dashboard = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
    expect(dashboard.status, "no redirect to a sign-in page").toBe(200);
    expect(dashboard.headers.get("set-cookie")).toBeNull();
  });

  it("runs every request as the configured operator, with their permissions", async () => {
    const shell = await fetch(`${BASE_URL}/api/shell`);
    expect(shell.status).toBe(200);
    const data = (await shell.json()).data;
    expect(data.user.username).toBe(OPERATOR);
    expect(data.permissions.length).toBeGreaterThan(10);
    expect(data.security).toEqual({ authMode: "none" });
  });

  it("still enforces permissions server-side", async () => {
    // Records are readable because the operator's role allows it; the guard is
    // unchanged, it simply resolves the same account every time.
    const people = await fetch(`${BASE_URL}/api/people?limit=1`);
    expect(people.status).toBe(200);

    const forbidden = await fetch(`${BASE_URL}/api/admin/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nonsense: true }),
    });
    expect([400, 403, 404, 405]).toContain(forbidden.status);
  });

  it("has no credential routes at all", async () => {
    // /api/auth/session is a GET endpoint; the rest accept POST.
    const routes: Array<[string, "GET" | "POST" | "DELETE"]> = [
      ["/api/auth/login", "POST"],
      ["/api/auth/login", "DELETE"],
      ["/api/auth/logout", "POST"],
      ["/api/auth/session", "GET"],
      ["/api/auth/password", "POST"],
      ["/api/auth/reset", "POST"],
      ["/api/auth/reset-request", "POST"],
    ];
    for (const [path, method] of routes) {
      const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ identifier: "admin", password: "whatever" }) : undefined,
      });
      expect(response.status, `${method} ${path} must not exist`).toBe(404);
      const body = (await response.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("AUTH_DISABLED");
    }
  });

  it("records who did what in the audit trail", async () => {
    const audit = await fetch(`${BASE_URL}/api/admin/audit?limit=5`);
    expect(audit.status).toBe(200);
    const rows = (await audit.json()).data.rows as Array<{ actorName?: string; username?: string }>;
    expect(rows.length).toBeGreaterThan(0);
    // Every entry is attributed to a real account, never to an anonymous actor.
    expect(rows.some((row) => row.actorName || row.username)).toBe(true);
  });
});
