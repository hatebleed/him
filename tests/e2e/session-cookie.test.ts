import { describe, expect, it } from "vitest";

/**
 * Session cookie + CSRF behaviour over real HTTP.
 *
 * Guards the failure mode where a sign-in succeeds server-side but the browser
 * silently discards the cookie, leaving the user staring at the login page.
 *
 *   RUN_E2E=1 E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ENABLED = process.env.RUN_E2E === "1";
// Cookie behaviour belongs to password authentication; with AUTH_MODE=none
// there is no session cookie at all (see tests/e2e/no-auth.test.ts).
const PASSWORD_AUTH = (process.env.AUTH_MODE ?? "password") === "password";
const PASSWORD = process.env.SEED_PASSWORD ?? "DemoPass123!";

async function login(headers: Record<string, string>) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ identifier: "admin", password: PASSWORD }),
    redirect: "manual",
  });
  return { status: response.status, setCookie: response.headers.get("set-cookie") ?? "" };
}

function sessionCookie(setCookie: string): string | null {
  return setCookie.split(/,(?=\s*him_session=)/).find((part) => part.startsWith("him_session="))?.split(";")[0] ?? null;
}

describe.skipIf(!ENABLED || !PASSWORD_AUTH)("session cookie delivery", () => {
  it("issues a cookie the browser keeps when the app is embedded over HTTPS", async () => {
    const result = await login({
      origin: "https://preview.example.test",
      referer: "https://preview.example.test/login",
      "sec-fetch-site": "same-origin",
    });
    expect(result.status).toBe(200);
    // A third-party context discards anything else, so this is the contract.
    expect(result.setCookie.toLowerCase()).toContain("samesite=none");
    expect(result.setCookie.toLowerCase()).toContain("secure");
    expect(result.setCookie.toLowerCase()).toContain("httponly");

    const shell = await fetch(`${BASE_URL}/api/shell`, { headers: { cookie: sessionCookie(result.setCookie) ?? "" } });
    expect(shell.status, "the issued cookie must authenticate the next request").toBe(200);
  });

  it("issues a partitioned (CHIPS) cookie when the client reports it is embedded", async () => {
    // When a browser blocks third-party cookies, a partitioned cookie is still
    // accepted inside the frame, so this is what keeps embedded sign-in working.
    const result = await login({
      origin: "https://portal.example.test",
      referer: "https://portal.example.test/app",
      "sec-fetch-site": "same-origin",
      "x-embedded": "1",
    });
    expect(result.status).toBe(200);
    expect(result.setCookie.toLowerCase()).toContain("partitioned");
    expect(result.setCookie.toLowerCase()).toContain("samesite=none");
    expect(result.setCookie.toLowerCase()).toContain("secure");

    const shell = await fetch(`${BASE_URL}/api/shell`, { headers: { cookie: sessionCookie(result.setCookie) ?? "" } });
    expect(shell.status).toBe(200);
  });

  it("keeps SameSite=Lax on a plain HTTP first-party deployment", async () => {
    const result = await login({ origin: "http://localhost:3000", referer: "http://localhost:3000/login" });
    expect(result.status).toBe(200);
    expect(result.setCookie.toLowerCase()).toContain("samesite=lax");
    expect(result.setCookie.toLowerCase()).not.toContain("secure");

    const shell = await fetch(`${BASE_URL}/api/shell`, { headers: { cookie: sessionCookie(result.setCookie) ?? "" } });
    expect(shell.status).toBe(200);
  });

  it("rejects a state-changing request that the browser reports as cross-site", async () => {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "sec-fetch-site": "cross-site", origin: "https://evil.test" },
      body: JSON.stringify({ identifier: "admin", password: PASSWORD }),
    });
    expect(response.status).toBe(403);
  });

  it("still accepts non-browser clients that send no origin metadata", async () => {
    expect((await login({})).status).toBe(200);
  });
});
