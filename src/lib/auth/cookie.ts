/**
 * Session cookie policy.
 *
 * The platform is normally served first-party (https://mdt.example.org), where
 * `SameSite=Lax` is both correct and the tightest option. It is also routinely
 * rendered inside a frame that belongs to another site - an embedded preview,
 * an intranet portal, a partner dashboard. In that context the browser treats
 * the cookie as third-party and *silently discards* anything that is not
 * `SameSite=None; Secure`, which is why a successful sign-in can appear to do
 * nothing at all.
 *
 * The policy is therefore resolved per request from evidence the browser
 * actually sends (`x-forwarded-proto`, `Origin`, `Referer`, `Sec-Fetch-Site`)
 * rather than from a single deployment-wide guess. `SameSite=None` is only ever
 * emitted together with `Secure`, because browsers reject the combination
 * otherwise, and the CSRF guard in `src/server/security/csrf.ts` is what keeps
 * `None` safe by rejecting cross-site write requests.
 */

export type SameSitePolicy = "lax" | "strict" | "none";

export type CookiePolicy = {
  /** Emit the `Secure` attribute. */
  secure: boolean;
  /** Emit this `SameSite` value. */
  sameSite: SameSitePolicy;
  /** Emit `Partitioned` (CHIPS), so the cookie survives third-party blocking. */
  partitioned: boolean;
  /** The browser reported this request as cross-site (embedded frame, etc.). */
  crossSite: boolean;
  /** The page is rendered inside a frame on another site. */
  embedded: boolean;
  /** Scheme the browser is using to reach us, when it can be determined. */
  scheme: "http" | "https" | null;
};

export type CookiePolicyOverrides = {
  /** Force the `Secure` attribute on or off. `null` (or omitted) means "detect". */
  secure?: boolean | null;
  /** Force a `SameSite` value. `null` (or omitted) means "detect". */
  sameSite?: SameSitePolicy | null;
  /** Force partitioned (CHIPS) handling. `null` (or omitted) means "detect". */
  embedded?: boolean | null;
};

/**
 * Header the client sets when it is rendered inside a frame, since a server
 * cannot tell an embedded page from a top-level one on a same-origin fetch.
 */
export const EMBEDDED_HEADER = "x-embedded";

const FORWARDED_PROTO = /proto=([^;,]+)/i;

function normaliseScheme(value: string | null | undefined): "http" | "https" | null {
  if (!value) return null;
  const scheme = value.trim().replace(/["']/g, "").toLowerCase();
  return scheme === "https" || scheme === "http" ? scheme : null;
}

function schemeFromUrl(value: string | null | undefined): "http" | "https" | null {
  if (!value) return null;
  try {
    return normaliseScheme(new URL(value).protocol.replace(":", ""));
  } catch {
    return null;
  }
}

/**
 * Determines whether the browser reached us over HTTPS.
 *
 * Priority matters, and it is deliberately not the obvious order:
 *
 * 1. `Origin` / `Referer` - sent by the browser itself and they name the URL
 *    the browser actually loaded. This is the only signal that survives a
 *    TLS-terminating proxy (an embedded preview, a CDN, an ingress) where the
 *    proxy-to-application hop is plain HTTP.
 * 2. `x-forwarded-proto` / `Forwarded` - used only when they claim HTTPS.
 *    A value of `http` is inconclusive, not evidence: it describes the last
 *    hop, which is HTTP in every TLS-terminating deployment, and Next.js even
 *    synthesises `x-forwarded-proto: http` when the header is absent.
 *
 * Getting this wrong is invisible - the browser silently drops the cookie and a
 * successful sign-in looks like a dead button - so plain HTTP is returned as
 * "unknown" rather than as a confident answer.
 */
export function detectScheme(headers: Headers): "http" | "https" | null {
  const fromBrowser = schemeFromUrl(headers.get("origin")) ?? schemeFromUrl(headers.get("referer"));
  if (fromBrowser) return fromBrowser;

  const forwarded =
    normaliseScheme(headers.get("x-forwarded-proto")?.split(",")[0]) ??
    normaliseScheme(FORWARDED_PROTO.exec(headers.get("forwarded") ?? "")?.[1]);
  return forwarded === "https" ? "https" : null;
}

/**
 * Resolves the cookie attributes for a request.
 *
 * - HTTPS (or an embedded cross-site frame) -> `Secure` + `SameSite=None`, so
 *   the session survives third-party contexts.
 * - Plain HTTP -> `SameSite=Lax`, which is the safe default for a first-party
 *   site and the only value a browser will accept without `Secure`.
 */
export function resolveCookiePolicy(headers: Headers, overrides: CookiePolicyOverrides = {}): CookiePolicy {
  const scheme = detectScheme(headers);
  const crossSite = headers.get("sec-fetch-site")?.trim().toLowerCase() === "cross-site";
  const embedded = overrides.embedded ?? (crossSite || headers.get(EMBEDDED_HEADER) === "1");

  const secure = overrides.secure ?? (scheme === "https" || (scheme === null && crossSite));

  let sameSite = overrides.sameSite ?? (secure ? "none" : "lax");
  // `SameSite=None` without `Secure` is rejected outright by every modern
  // browser; clamping to Lax keeps the session working on plain HTTP.
  if (sameSite === "none" && !secure) sameSite = "lax";

  // CHIPS: a partitioned cookie is the one kind modern browsers still accept in
  // a third-party context when third-party cookies are blocked altogether.
  // It requires `Secure`, so plain HTTP deployments keep an ordinary cookie.
  const partitioned = secure && embedded;

  return { secure, sameSite, partitioned, crossSite, embedded, scheme };
}

/** Cookie attributes for the resolved policy (shared by set and clear). */
export function cookieOptions(policy: CookiePolicy, expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: policy.sameSite,
    secure: policy.secure,
    partitioned: policy.partitioned,
    path: "/",
    expires: expiresAt,
  } as const;
}
