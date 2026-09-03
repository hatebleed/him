import { describe, expect, it } from "vitest";

import { assertSameOrigin, isSafeMethod, requestHost, trustedHosts } from "@/server/security/csrf";

/**
 * Because the session cookie is usable from embedded contexts, the API needs a
 * real cross-site write guard. These tests cover the browser signals that must
 * be accepted, the ones that must be rejected, and the non-browser clients that
 * must keep working (CLI tools, server-to-server calls, this suite).
 */
function request(
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): { method: string; url: string; headers: Headers } {
  return {
    method: init.method ?? "POST",
    url,
    headers: new Headers(init.headers ?? {}),
  };
}

const APP = "https://mdt.example.org/api/incidents";

describe("cross-site request forgery guard", () => {
  it("treats only GET/HEAD/OPTIONS as safe", () => {
    expect(isSafeMethod("GET")).toBe(true);
    expect(isSafeMethod("head")).toBe(true);
    expect(isSafeMethod("POST")).toBe(false);
    expect(isSafeMethod("DELETE")).toBe(false);
  });

  it("allows writes that browsers report as same-origin", () => {
    expect(() =>
      assertSameOrigin(request(APP, { headers: { "sec-fetch-site": "same-origin", origin: "https://mdt.example.org" } })),
    ).not.toThrow();
  });

  it("allows writes from inside an embedded frame of the same origin", () => {
    // A frame served from this origin is "same-origin", not "cross-site", so
    // embedding the application keeps working.
    expect(() =>
      assertSameOrigin(
        request(APP, { headers: { "sec-fetch-site": "same-origin", "sec-fetch-dest": "empty", origin: "https://mdt.example.org" } }),
      ),
    ).not.toThrow();
  });

  it("rejects writes that browsers report as cross-site", () => {
    expect(() => assertSameOrigin(request(APP, { headers: { "sec-fetch-site": "cross-site", origin: "https://evil.test" } }))).toThrow(
      /originated from another site/,
    );
  });

  it("never blocks safe methods, even cross-site ones", () => {
    expect(() =>
      assertSameOrigin(
        { ...request(APP, { method: "GET" }), headers: new Headers({ "sec-fetch-site": "cross-site" }) },
      ),
    ).not.toThrow();
  });

  it("falls back to the Origin header when Sec-Fetch-Site is absent", () => {
    expect(() => assertSameOrigin(request(APP, { headers: { origin: "https://mdt.example.org" } }))).not.toThrow();
    expect(() => assertSameOrigin(request(APP, { headers: { origin: "https://evil.test" } }))).toThrow(/another site/);
  });

  it("trusts the proxy-supplied host so a rewritten Host header cannot break writes", () => {
    const proxied = request(APP, {
      headers: { origin: "https://3000-sandbox.example.app", "x-forwarded-host": "3000-sandbox.example.app", host: "localhost:3000" },
    });
    expect(requestHost(proxied)).toBe("3000-sandbox.example.app");
    expect(() => assertSameOrigin(proxied)).not.toThrow();
  });

  it("allows non-browser clients that send no origin metadata", () => {
    expect(() => assertSameOrigin(request(APP))).not.toThrow();
  });

  it("includes the configured application URL and trusted origins", () => {
    const hosts = trustedHosts(request(APP));
    expect(hosts.has("mdt.example.org")).toBe(true);
  });
});
