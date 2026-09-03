import { describe, expect, it } from "vitest";

import { cookieOptions, detectScheme, resolveCookiePolicy } from "@/lib/auth/cookie";

/**
 * The session cookie is the difference between "signed in" and "nothing
 * happened". These cases pin the behaviour for every context the platform is
 * served from: first-party HTTP, first-party HTTPS, TLS-terminating proxies and
 * embedded (cross-site) frames.
 */
function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("session cookie policy", () => {
  it("uses SameSite=Lax without Secure on plain HTTP (local development)", () => {
    const policy = resolveCookiePolicy(headers({ origin: "http://localhost:3000", referer: "http://localhost:3000/login" }));
    expect(policy).toMatchObject({ secure: false, sameSite: "lax", crossSite: false });
  });

  it("uses Secure + SameSite=None when the browser reaches us over HTTPS", () => {
    const policy = resolveCookiePolicy(headers({ "x-forwarded-proto": "https" }));
    expect(policy).toMatchObject({ secure: true, sameSite: "none" });
  });

  it("detects HTTPS through a proxy that only forwards Origin/Referer", () => {
    const policy = resolveCookiePolicy(
      headers({ origin: "https://3000-sandbox.example.app", referer: "https://3000-sandbox.example.app/login" }),
    );
    expect(policy.scheme).toBe("https");
    expect(policy).toMatchObject({ secure: true, sameSite: "none" });
  });

  it("detects HTTPS from the standard Forwarded header", () => {
    expect(detectScheme(headers({ forwarded: 'for=10.0.0.1;proto=https;host=mdt.example.org' }))).toBe("https");
  });

  it("does not let an HTTP proxy hop contradict the browser", () => {
    // TLS is terminated at the edge and the proxy-to-app hop is plain HTTP.
    // The browser is on HTTPS, so the cookie must be Secure + SameSite=None or
    // it is discarded and the sign-in silently fails.
    const policy = resolveCookiePolicy(
      headers({
        "x-forwarded-proto": "http",
        origin: "https://3000-sandbox.example.app",
        referer: "https://3000-sandbox.example.app/login",
        "sec-fetch-site": "same-origin",
      }),
    );
    expect(policy).toMatchObject({ secure: true, sameSite: "none" });
  });

  it("treats a plain HTTP proxy hop as unknown, not as proof of HTTP", () => {
    // Next.js synthesises `x-forwarded-proto: http` when the header is absent.
    expect(detectScheme(headers({ "x-forwarded-proto": "http" }))).toBeNull();
  });

  it("flags embedded cross-site requests and still emits a usable cookie", () => {
    const policy = resolveCookiePolicy(
      headers({ "sec-fetch-site": "cross-site", referer: "https://preview.example.app/login" }),
    );
    expect(policy.crossSite).toBe(true);
    // SameSite=Lax is rejected outright in a third-party context, so the
    // cookie must be None + Secure or the session is silently dropped.
    expect(policy).toMatchObject({ secure: true, sameSite: "none" });
  });

  it("never emits SameSite=None without Secure, which browsers reject", () => {
    const policy = resolveCookiePolicy(headers({ origin: "http://insecure.example" }), { sameSite: "none" });
    expect(policy.secure).toBe(false);
    expect(policy.sameSite).toBe("lax");
  });

  it("honours operator overrides for both attributes", () => {
    expect(resolveCookiePolicy(headers({}), { secure: true, sameSite: "strict" })).toMatchObject({
      secure: true,
      sameSite: "strict",
    });
    expect(resolveCookiePolicy(headers({ "x-forwarded-proto": "https" }), { secure: false })).toMatchObject({
      secure: false,
      sameSite: "lax",
    });
  });

  it("returns null when the scheme cannot be determined", () => {
    expect(detectScheme(headers({}))).toBeNull();
  });

  it("issues a partitioned (CHIPS) cookie when the page is embedded", () => {
    // Browsers that block third-party cookies still accept a partitioned one.
    const policy = resolveCookiePolicy(
      headers({ origin: "https://portal.example.test", referer: "https://portal.example.test/app", "x-embedded": "1" }),
    );
    expect(policy).toMatchObject({ secure: true, sameSite: "none", partitioned: true, embedded: true });

    const attributes = cookieOptions(policy, new Date(Date.now() + 60_000));
    expect(attributes.partitioned).toBe(true);
    expect(attributes.secure).toBe(true);
  });

  it("never partitions a cookie that is not Secure, or a first-party one", () => {
    const firstParty = resolveCookiePolicy(headers({ origin: "https://mdt.example.org", "sec-fetch-site": "same-origin" }));
    expect(firstParty).toMatchObject({ secure: true, partitioned: false, embedded: false });

    const plainHttp = resolveCookiePolicy(headers({ origin: "http://localhost:3000", "x-embedded": "1" }));
    expect(plainHttp).toMatchObject({ secure: false, partitioned: false });
  });

  it("treats a cross-site request as embedded even without the client header", () => {
    expect(resolveCookiePolicy(headers({ "sec-fetch-site": "cross-site", referer: "https://other.test/page" }))).toMatchObject({
      embedded: true,
    });
  });

  it("produces cookie attributes that match the policy", () => {
    const embedded = resolveCookiePolicy(headers({ "x-forwarded-proto": "https" }));
    expect(cookieOptions(embedded, new Date(0))).toMatchObject({ httpOnly: true, sameSite: "none", secure: true, path: "/" });

    const local = resolveCookiePolicy(headers({ origin: "http://localhost:3000" }));
    expect(cookieOptions(local, new Date(0))).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  });
});
