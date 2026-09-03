import "server-only";

import { AppError } from "@/lib/errors";
import { env, trustedOrigins } from "@/lib/env";

/**
 * Cross-site request forgery protection for the JSON API.
 *
 * The session cookie is deliberately usable from embedded contexts
 * (`SameSite=None`, see `src/lib/auth/cookie.ts`), which means the browser will
 * attach it to cross-site requests too. This guard closes that hole without
 * breaking legitimate embedding: a page can only write to this API when the
 * browser tells us the request originated from this origin.
 *
 * Two independent signals are used, in order:
 *
 * 1. `Sec-Fetch-Site` (Chrome/Edge/Firefox/Safari 16.4+) - sent by the browser
 *    and impossible for page script to spoof. For an app embedded in a frame
 *    the document origin *is* the app origin, so requests from inside the frame
 *    are `same-origin` and remain allowed.
 * 2. `Origin` - sent by every browser on non-GET requests. Used when
 *    `Sec-Fetch-Site` is unavailable (older Safari, some embedded webviews).
 *
 * Neither header is sent by non-browser clients (curl, server-to-server calls,
 * the test suite). Those are not CSRF vectors - there is no ambient cookie jar
 * to abuse - so they are allowed through.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

export type OriginRequest = { method: string; url: string; headers: Headers };

/** True when the method cannot change server state. */
export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

/** The host the client is addressing, honouring proxy headers. */
export function requestHost(request: OriginRequest): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) return forwardedHost.toLowerCase();
  const host = request.headers.get("host")?.trim();
  if (host) return host.toLowerCase();
  try {
    return new URL(request.url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Hosts this deployment accepts `Origin` headers from. */
export function trustedHosts(request: OriginRequest): Set<string> {
  const hosts = new Set<string>();
  const own = requestHost(request);
  if (own) hosts.add(own);

  for (const value of [env.APP_URL, ...trustedOrigins()]) {
    const entry = value?.trim();
    if (!entry) continue;
    try {
      hosts.add(new URL(entry).host.toLowerCase());
    } catch {
      // Tolerate bare host values such as "portal.example.org:8443".
      hosts.add(entry.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase());
    }
  }
  return hosts;
}

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Throws a 403 when a state-changing request demonstrably came from another
 * site. Safe methods and non-browser clients are always allowed.
 */
export function assertSameOrigin(request: OriginRequest): void {
  if (isSafeMethod(request.method)) return;

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite) {
    if (ALLOWED_FETCH_SITES.has(fetchSite)) return;
    throw new AppError({
      code: "CROSS_SITE_REQUEST_BLOCKED",
      status: 403,
      message: "This request was blocked because it originated from another site.",
    });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const host = originHost(origin);
    if (host && trustedHosts(request).has(host)) return;
    throw new AppError({
      code: "CROSS_SITE_REQUEST_BLOCKED",
      status: 403,
      message: "This request was blocked because it originated from another site.",
    });
  }

  // No browser origin metadata: a non-browser client. Not a CSRF vector.
}
