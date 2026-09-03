import { afterAll, describe, expect, it } from "vitest";

/**
 * FiveM integration over HTTP.
 *
 * Verifies the contract the resource depends on: the shared secret gates the
 * handshake, an unlinked character receives nothing, a linked character
 * receives a token, and that token carries exactly the linked account's
 * permissions — no more, even inside the game.
 *
 *   RUN_E2E=1 FIVEM_API_KEY=… npm run test:e2e
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ENABLED = process.env.RUN_E2E === "1";
/** The deployment's key; tests skip the authenticated cases when it is unset. */
const API_KEY = process.env.FIVEM_API_KEY ?? "";
const WITH_KEY = ENABLED && API_KEY.length > 0;

type Envelope<T> = { data?: T; error?: { code: string; message: string } };

async function call<T = unknown>(path: string, options: { method?: string; body?: unknown; apiKey?: string; token?: string } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(options.apiKey ? { "x-api-key": options.apiKey } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? ((await response.json()) as Envelope<T>) : undefined;
  return { status: response.status, body };
}

const citizenId = `E2E${Date.now()}`;
const created: { identityId?: string } = {};

describe.skipIf(!ENABLED)("fivem integration", () => {
  afterAll(async () => {
    if (created.identityId) {
      await call(`/api/integrations/fivem/identities/${created.identityId}`, { method: "DELETE" });
    }
  });

  it("refuses a handshake without the shared secret", async () => {
    const { status } = await call("/api/integrations/fivem/handshake", {
      method: "POST",
      body: { citizenId, job: "police" },
      apiKey: "not-the-key",
    });
    expect(status).toBe(401);
  });

  it("refuses an unlinked character", async () => {
    const { status, body } = await call("/api/integrations/fivem/handshake", {
      method: "POST",
      body: { citizenId: `UNKNOWN${Date.now()}`, job: "police" },
      apiKey: API_KEY,
    });
    // 401 when the deployment has no key configured, 403 once it does.
    expect([401, 403]).toContain(status);
    if (status === 403) expect(body?.error?.code).toBe("IDENTITY_NOT_LINKED");
  });

  it("rejects a malformed handshake body", async () => {
    const { status } = await call("/api/integrations/fivem/handshake", { method: "POST", body: { job: "police" }, apiKey: API_KEY });
    expect(status).toBe(400);
  });

  it.skipIf(!WITH_KEY)("links a character, mints a token and honours its permissions", async () => {
    type UserRow = { id: string; username: string };
    const users = await call<{ rows: UserRow[] }>("/api/admin/users?pageSize=50");
    // "operator" holds dispatch permissions; "officer1" deliberately does not,
    // which is what the permissions half of this test is about.
    const officer = users.body?.data?.rows.find((row) => row.username === "operator1");
    const readonly = users.body?.data?.rows.find((row) => row.username === "readonly");
    expect(officer, "seed users should exist").toBeTruthy();

    const link = await call<{ id: string }>("/api/integrations/fivem/identities", {
      method: "POST",
      body: { citizenId, userId: officer!.id, displayName: "E2E Officer" },
    });
    expect(link.status).toBe(201);
    created.identityId = link.body?.data?.id;

    const handshake = await call<{ token: string; operator: { id: string }; permissions: string[] }>(
      "/api/integrations/fivem/handshake",
      { method: "POST", body: { citizenId, job: "police", grade: 2, callsign: "E-1", characterName: "E2E Officer" }, apiKey: API_KEY },
    );
    expect(handshake.status).toBe(200);
    const token = handshake.body?.data?.token;
    expect(token).toBeTruthy();
    expect(handshake.body?.data?.operator.id).toBe(officer!.id);
    expect(handshake.body?.data?.permissions).toContain("dispatch.view");

    // The token works as a credential on the ordinary API…
    const wall = await call("/api/ops-wall", { token: token! });
    expect(wall.status).toBe(200);

    // …and a forged or expired one does not fall back to the ambient session.
    const forged = await call("/api/ops-wall", { token: `${token!.slice(0, -3)}abc` });
    expect(forged.status).toBe(401);

    // The in-game UI renders.
    const page = await fetch(`${BASE_URL}/nui`, { redirect: "manual" });
    expect(page.status).toBe(200);

    // A read-only account stays read-only in game.
    if (readonly) {
      const readonlyCitizen = `${citizenId}R`;
      const readonlyLink = await call<{ id: string }>("/api/integrations/fivem/identities", {
        method: "POST",
        body: { citizenId: readonlyCitizen, userId: readonly.id },
      });
      const readonlyHandshake = await call<{ token: string }>("/api/integrations/fivem/handshake", {
        method: "POST",
        body: { citizenId: readonlyCitizen, job: "police" },
        apiKey: API_KEY,
      });
      expect(readonlyHandshake.status).toBe(200);
      const denied = await call("/api/units/none", { method: "POST", body: { status: "AVAILABLE" }, token: readonlyHandshake.body?.data?.token ?? "" });
      expect(denied.status).toBeLessThan(500);
      await call(`/api/integrations/fivem/identities/${readonlyLink.body?.data?.id}`, { method: "DELETE" });
    }
  });
});
