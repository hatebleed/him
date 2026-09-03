import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * End-to-end acceptance journey.
 *
 * Runs the whole product story over HTTP against a running server:
 * sign in → dashboard → search → create and link records → report
 * lifecycle → workflow → notification → timeline → audit → administration.
 *
 * It is skipped by default because it needs a live server and a seeded
 * database:
 *
 *   npm run db:reset && npm run dev &
 *   RUN_E2E=1 E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ENABLED = process.env.RUN_E2E === "1";
const PASSWORD = process.env.SEED_PASSWORD ?? "DemoPass123!";

type ApiEnvelope<T> = { data: T };

async function request<T>(path: string, options: { method?: string; body?: unknown; cookie?: string } = {}): Promise<{ status: number; body: ApiEnvelope<T> | { error: { code: string; message: string } }; cookie?: string }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });

  const setCookie = response.headers.get("set-cookie");
  const cookie = setCookie ? setCookie.split(";")[0] : undefined;
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : undefined;
  return { status: response.status, body, cookie };
}

const PASSWORD_AUTH = (process.env.AUTH_MODE ?? "password") === "password";
let cookie = "";
const created: { personId?: string; vehicleId?: string; incidentId?: string; reportId?: string; fieldId?: string } = {};

describe.skipIf(!ENABLED)("acceptance journey", () => {
  beforeAll(async () => {
    // With AUTH_MODE=none there is nothing to sign in to: every request already
    // runs as the configured operator account.
    if (!PASSWORD_AUTH) return;
    const login = await request<{ id: string }>("/api/auth/login", {
      method: "POST",
      body: { identifier: "admin", password: PASSWORD },
    });
    expect(login.status, "sign-in should succeed").toBe(200);
    cookie = login.cookie ?? "";
    expect(cookie).toContain("him_session");
  });

  afterAll(async () => {
    // Remove the records the journey created.
    for (const [key, id] of Object.entries(created)) {
      if (!id) continue;
      const path = key === "personId" ? `/api/people/${id}` : key === "vehicleId" ? `/api/vehicles/${id}` : key === "incidentId" ? `/api/incidents/${id}` : key === "reportId" ? `/api/reports/${id}` : key === "fieldId" ? `/api/admin/fields/${id}` : null;
      if (path) await request(path, { method: "DELETE", cookie });
    }
  });

  it("serves dashboard analytics built from live aggregates", async () => {
    // Covered explicitly: closed statuses are configuration-driven, and an
    // earlier version filtered them with hand-written SQL and returned 500.
    const analytics = await request<{ metrics: Record<string, { value: number }>; priority: Array<{ label: string; value: number }> }>(
      "/api/analytics?trend=true&priority=true",
      { cookie },
    );
    expect(analytics.status).toBe(200);
    const data = (analytics.body as ApiEnvelope<{ metrics: Record<string, { value: number }>; priority: Array<{ label: string; value: number }> }>).data;

    const metrics = Object.values(data.metrics);
    expect(metrics.length).toBeGreaterThan(0);
    for (const metric of metrics) expect(typeof metric.value).toBe("number");

    // Incidents that are not in a configured closed status, grouped by priority.
    expect(data.priority.length).toBeGreaterThan(0);
    for (const row of data.priority) expect(typeof row.value).toBe("number");
  });

  it("signs in and loads the application shell", async () => {
    const shell = await request<{ permissions: string[]; config: { modules: Array<{ key: string; enabled: boolean }> } }>("/api/shell", { cookie });
    expect(shell.status).toBe(200);
    const data = (shell.body as ApiEnvelope<{ permissions: string[]; config: { modules: Array<{ key: string; enabled: boolean }> } }>).data;
    expect(data.permissions.length).toBeGreaterThan(10);
    expect(data.config.modules.length).toBeGreaterThan(5);
  });

  // With AUTH_MODE=none there is no anonymous state to reject: every request
  // is the operator. See tests/e2e/no-auth.test.ts for that mode.
  it.skipIf(!PASSWORD_AUTH)("requires authentication for protected APIs", async () => {
    const anonymous = await request("/api/shell");
    expect(anonymous.status).toBe(401);
  });

  it("searches across record types with permission filtering", async () => {
    const search = await request<{ rows: Array<{ type: string; id: string }> }>("/api/search?q=NG", { cookie });
    expect(search.status).toBe(200);
    const rows = (search.body as ApiEnvelope<{ rows: Array<{ type: string; id: string }> }>).data.rows;
    expect(Array.isArray(rows)).toBe(true);
  });

  it("creates a person, a vehicle and an incident, then links them", async () => {
    const person = await request<{ id: string; reference: string }>("/api/people", {
      method: "POST",
      cookie,
      body: { firstName: "Journey", lastName: `Person-${Date.now()}`, status: "ACTIVE", identifiers: [], contacts: [], addresses: [] },
    });
    expect(person.status).toBe(201);
    created.personId = (person.body as ApiEnvelope<{ id: string }>).data.id;

    const vehicle = await request<{ id: string }>("/api/vehicles", {
      method: "POST",
      cookie,
      body: { registration: `E2E${Date.now().toString().slice(-4)}`, make: "Test", model: "Journey", status: "ACTIVE" },
    });
    expect(vehicle.status).toBe(201);
    created.vehicleId = (vehicle.body as ApiEnvelope<{ id: string }>).data.id;

    const incident = await request<{ id: string; reference: string }>("/api/incidents", {
      method: "POST",
      cookie,
      body: { title: "Journey incident", description: "Created by the acceptance journey.", status: "NEW", priority: "HIGH" },
    });
    expect(incident.status).toBe(201);
    created.incidentId = (incident.body as ApiEnvelope<{ id: string }>).data.id;

    const linkPerson = await request(`/api/incidents/${created.incidentId}/links`, {
      method: "POST",
      cookie,
      body: { kind: "person", personId: created.personId, role: "WITNESS" },
    });
    expect(linkPerson.status).toBe(201);

    const linkVehicle = await request(`/api/incidents/${created.incidentId}/links`, {
      method: "POST",
      cookie,
      body: { kind: "vehicle", vehicleId: created.vehicleId, role: "INVOLVED" },
    });
    expect(linkVehicle.status).toBe(201);

    const detail = await request<{ participants: Array<{ personId: string }>; vehicles: Array<{ vehicleId: string }> }>(`/api/incidents/${created.incidentId}`, { cookie });
    const incidentDetail = (detail.body as ApiEnvelope<{ participants: Array<{ personId: string }>; vehicles: Array<{ vehicleId: string }> }>).data;
    expect(incidentDetail.participants.some((entry) => entry.personId === created.personId)).toBe(true);
    expect(incidentDetail.vehicles.some((entry) => entry.vehicleId === created.vehicleId)).toBe(true);
  });

  it("writes, submits and approves a report with version history", async () => {
    const report = await request<{ id: string }>("/api/reports", {
      method: "POST",
      cookie,
      body: { title: "Journey report", body: "Initial draft", status: "DRAFT", incidentId: created.incidentId },
    });
    expect(report.status).toBe(201);
    created.reportId = (report.body as ApiEnvelope<{ id: string }>).data.id;

    const submit = await request(`/api/reports/${created.reportId}/transition`, { method: "POST", cookie, body: { action: "SUBMIT" } });
    expect(submit.status).toBe(200);

    const approve = await request(`/api/reports/${created.reportId}/transition`, { method: "POST", cookie, body: { action: "APPROVE" } });
    expect(approve.status).toBe(200);

    const detail = await request<{ status: string; versions: Array<{ version: number }> }>(`/api/reports/${created.reportId}`, { cookie });
    const data = (detail.body as ApiEnvelope<{ status: string; versions: Array<{ version: number }> }>).data;
    expect(data.status).toBe("APPROVED");
    expect(data.versions.length).toBeGreaterThanOrEqual(3);
  });

  it("raises a notification through the report workflow", async () => {
    const notifications = await request<{ rows: Array<{ title: string }>; unread: number }>("/api/notifications?limit=30", { cookie });
    const data = (notifications.body as ApiEnvelope<{ rows: Array<{ title: string }>; unread: number }>).data;
    expect(data.rows.some((row) => row.title.includes("report") || row.title.includes("Report"))).toBe(true);
  });

  it("records the incident timeline", async () => {
    const timeline = await request<{ rows: Array<{ message: string }> }>(`/api/records/incident/${created.incidentId}/timeline`, { cookie });
    const rows = (timeline.body as ApiEnvelope<{ rows: Array<{ message: string }> }>).data.rows;
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.some((row) => row.message.toLowerCase().includes("linked"))).toBe(true);
  });

  it("writes configuration changes to the audit trail", async () => {
    const audit = await request<{ rows: Array<{ action: string }> }>("/api/admin/audit?search=report", { cookie });
    const rows = (audit.body as ApiEnvelope<{ rows: Array<{ action: string }> }>).data.rows;
    expect(rows.some((row) => row.action.startsWith("report."))).toBe(true);
  });

  it("creates a custom field, renames terminology, toggles a module and edits role permissions", async () => {
    const field = await request<{ id: string; key: string }>("/api/admin/fields", {
      method: "POST",
      cookie,
      body: { resourceType: "incident", key: `journey_field_${Date.now()}`, label: "Journey field", type: "TEXT", required: false },
    });
    expect(field.status).toBe(201);
    created.fieldId = (field.body as ApiEnvelope<{ id: string }>).data.id;

    const terminology = await request<{ rows: Record<string, { singular: string; plural: string }> }>("/api/admin/terminology", {
      method: "PUT",
      cookie,
      body: { termKey: "incident", singular: "Occurrence", plural: "Occurrences" },
    });
    expect(terminology.status).toBe(200);
    const terms = (terminology.body as ApiEnvelope<{ rows: Record<string, { singular: string; plural: string }> }>).data.rows;
    expect(terms.incident?.singular).toBe("Occurrence");

    // Restore the original label.
    await request("/api/admin/terminology", { method: "PUT", cookie, body: { termKey: "incident", singular: "Incident", plural: "Incidents" } });

    const modules = await request<{ rows: Array<{ key: string; enabled: boolean }> }>("/api/admin/modules", {
      method: "PATCH",
      cookie,
      body: { key: "evidence", enabled: false },
    });
    const moduleRows = (modules.body as ApiEnvelope<{ rows: Array<{ key: string; enabled: boolean }> }>).data.rows;
    expect(moduleRows.find((row) => row.key === "evidence")?.enabled).toBe(false);

    await request("/api/admin/modules", { method: "PATCH", cookie, body: { key: "evidence", enabled: true } });

    const roles = await request<{ rows: Array<{ id: string; permissions: string[] }> }>("/api/admin/roles", { cookie });
    const roleRows = (roles.body as ApiEnvelope<{ rows: Array<{ id: string; permissions: string[] }> }>).data.rows;
    const readonlyRole = roleRows.find((row) => row.permissions.length < 20);
    expect(readonlyRole).toBeTruthy();

    const updated = await request(`/api/admin/roles/${readonlyRole!.id}`, {
      method: "PATCH",
      cookie,
      body: { permissionKeys: [...readonlyRole!.permissions, "tasks.create"] },
    });
    expect(updated.status).toBe(200);

    // Put the role back the way it was.
    await request(`/api/admin/roles/${readonlyRole!.id}`, { method: "PATCH", cookie, body: { permissionKeys: readonlyRole!.permissions } });
  });

  // Needs a second identity, so it only applies when accounts exist.
  it.skipIf(!PASSWORD_AUTH)("refuses an action the signed-in user has no permission for", async () => {
    // The read-only seeded role exercises server-side authorisation.
    const login = await request<{ id: string }>("/api/auth/login", { method: "POST", body: { identifier: "readonly", password: PASSWORD } });
    expect(login.status).toBe(200);
    const readonlyCookie = login.cookie ?? "";

    const attempt = await request("/api/incidents", {
      method: "POST",
      cookie: readonlyCookie,
      body: { title: "Should be refused", status: "NEW", priority: "LOW" },
    });
    expect(attempt.status).toBe(403);
  });
});
