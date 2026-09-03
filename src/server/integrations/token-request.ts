import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { looksLikeIntegrationToken, verifyIntegrationToken } from "@/lib/integrations/token";
import type { AuthenticatedUser } from "@/lib/auth/session";

export const BEARER_PREFIX = "bearer ";

/** The raw bearer token, when the request carries one. */
export function bearerToken(request: { headers: Headers }): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const value = header.slice(0, 7).toLowerCase() === BEARER_PREFIX ? header.slice(7).trim() : header.trim();
  return value || null;
}

/**
 * True when the request authenticates with an integration token rather than a
 * browser session.
 *
 * Such requests carry no ambient credentials, so they are not a cross-site
 * request forgery vector and are exempt from the origin check.
 */
export function isIntegrationRequest(request: { headers: Headers }): boolean {
  return looksLikeIntegrationToken(bearerToken(request));
}

/** Shared secret supplied by the game server, compared in constant time. */
export function assertIntegrationSecret(request: { headers: Headers }): void {
  const expected = env.FIVEM_API_KEY;
  if (!expected) {
    throw new AppError({
      code: "INTEGRATION_DISABLED",
      message: "The FiveM integration is not configured. Set FIVEM_API_KEY to enable it.",
      status: 503,
    });
  }
  const provided = request.headers.get("x-api-key") ?? bearerToken(request) ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingEqual(a, b)) {
    throw new AppError({ code: "UNAUTHENTICATED", message: "Invalid integration credentials.", status: 401 });
  }
}

/** Constant-time comparison that tolerates differing lengths. */
function timingEqual(a: Buffer, b: Buffer): boolean {
  let mismatch = 0;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return mismatch === 0;
}

/**
 * Resolves the user an integration token acts as.
 *
 * A request that presents a token is held to it: an invalid token is a 401
 * rather than a fall-through to the ambient session, so a forged header can
 * never be used to smuggle a request past the origin check.
 */
export async function userForIntegrationToken(token: string): Promise<AuthenticatedUser | null> {
  const payload = verifyIntegrationToken(token);
  if (!payload) return null;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      jobTitle: users.jobTitle,
      badgeNumber: users.badgeNumber,
      status: users.status,
      avatarUrl: users.avatarUrl,
      departmentId: users.departmentId,
      mfaEnabled: users.mfaEnabled,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
    .limit(1);

  if (!user || user.status !== "ACTIVE") return null;
  // Integration tokens are short-lived and minted per character; the "session"
  // they represent expires with the token itself.
  return { ...user, sessionExpiresAt: new Date((verifyIntegrationToken(token)?.exp ?? 0) * 1000) };
}
