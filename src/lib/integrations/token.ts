import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Integration access tokens.
 *
 * A game server (or any trusted integration) exchanges a shared secret for a
 * short-lived token that identifies one player. The token is stateless and
 * signed with the same secret the session layer uses, so no table is needed to
 * validate it and nothing has to be cleaned up when it expires.
 *
 * Format: `fiv1.<base64url payload>.<base64url signature>`
 */

export const INTEGRATION_PROVIDER = "fivem";
export const TOKEN_PREFIX = "fiv1";

export type IntegrationTokenPayload = {
  /** User id the token acts as. */
  sub: string;
  /** Integration that minted it. */
  provider: string;
  /** Unique token id (audit and future revocation). */
  jti: string;
  /** Issued at / expires at, seconds since the epoch. */
  iat: number;
  exp: number;
  /** Character context supplied by the game server (never used for authorisation). */
  character?: {
    citizenId: string;
    job?: string | null;
    grade?: number | null;
    callsign?: string | null;
    name?: string | null;
  };
};

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

/** Mints a token that acts as `userId` for `ttlHours`. */
export function signIntegrationToken(
  input: { sub: string; provider?: string; character?: IntegrationTokenPayload["character"]; ttlHours?: number },
  now = Date.now(),
): { token: string; expiresAt: Date } {
  const issued = Math.floor(now / 1000);
  const ttlHours = input.ttlHours ?? env.FIVEM_TOKEN_TTL_HOURS;
  const payload: IntegrationTokenPayload = {
    sub: input.sub,
    provider: input.provider ?? INTEGRATION_PROVIDER,
    jti: createHmac("sha256", env.AUTH_SECRET).update(`${input.sub}:${issued}:${Math.random()}`).digest("base64url").slice(0, 16),
    iat: issued,
    exp: issued + Math.round(ttlHours * 3600),
    character: input.character,
  };
  const body = b64url(JSON.stringify(payload));
  return {
    token: `${TOKEN_PREFIX}.${body}.${sign(body)}`,
    expiresAt: new Date(payload.exp * 1000),
  };
}

/** Returns the payload when the signature and expiry are valid, otherwise null. */
export function verifyIntegrationToken(token: string, now = Date.now()): IntegrationTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const [, body, signature] = parts as [string, string, string];

  const expected = Buffer.from(sign(body));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as IntegrationTokenPayload;
    if (!payload?.sub || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** True when the header value looks like an integration token (before verifying). */
export function looksLikeIntegrationToken(header: string | null | undefined): boolean {
  return typeof header === "string" && header.startsWith(`${TOKEN_PREFIX}.`);
}
