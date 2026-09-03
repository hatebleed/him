import "server-only";

import { and, eq, isNull, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";

import { cookieOptions, resolveCookiePolicy, type CookiePolicy } from "./cookie";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = env.SESSION_COOKIE_NAME;

/** Anything that can carry a `Set-Cookie` header (a `NextResponse`, in practice). */
type CookieWriter = { cookies: NextResponse["cookies"] };

/** Operator overrides from configuration; `null` means "detect per request". */
function policyOverrides() {
  return {
    secure: env.COOKIE_SECURE === "auto" ? null : env.COOKIE_SECURE === "true",
    sameSite: env.COOKIE_SAMESITE === "auto" ? null : env.COOKIE_SAMESITE,
  };
}

/**
 * Resolves the session cookie attributes for a request.
 *
 * The browser-facing scheme is detected from the request itself rather than a
 * single global flag, so the same build works first-party, behind a
 * TLS-terminating proxy and inside an embedded frame on another site.
 */
export function sessionCookiePolicy(headers: Headers): CookiePolicy {
  return resolveCookiePolicy(headers, policyOverrides());
}

/** Writes the session cookie onto a response using the resolved policy. */
export function applySessionCookie(response: CookieWriter, token: string, expiresAt: Date, headers: Headers): CookiePolicy {
  const policy = sessionCookiePolicy(headers);
  response.cookies.set({ name: SESSION_COOKIE, value: token, ...cookieOptions(policy, expiresAt) });
  return policy;
}

/** Clears the session cookie, matching the attributes it was written with. */
export function clearSessionCookie(response: CookieWriter, headers: Headers): void {
  const policy = sessionCookiePolicy(headers);
  response.cookies.set({ name: SESSION_COOKIE, value: "", ...cookieOptions(policy, new Date(0)) });
}

export function sessionTtlMs() {
  return env.SESSION_TTL_HOURS * 60 * 60 * 1000;
}

/**
 * Issues a new session and persists only its hash.
 *
 * The cookie itself is written by the caller (`applySessionCookie`) so the
 * response carries exactly one `Set-Cookie` header with the correct
 * per-request attributes.
 */
export async function createSession(
  userId: string,
  context: { ip?: string | null; userAgent?: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    ip: context.ip ?? null,
    userAgent: context.userAgent ?? null,
  });
  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  jobTitle: string | null;
  badgeNumber: string | null;
  avatarUrl: string | null;
  status: string;
  departmentId: string | null;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  sessionExpiresAt: Date;
};

/**
 * Resolves the current session from the signed-in cookie.
 * Returns null for anonymous, expired, revoked, deleted or disabled accounts.
 */
export async function getSessionUser(): Promise<AuthenticatedUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      jobTitle: users.jobTitle,
      badgeNumber: users.badgeNumber,
      avatarUrl: users.avatarUrl,
      status: users.status,
      departmentId: users.departmentId,
      mfaEnabled: users.mfaEnabled,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      deletedAt: users.deletedAt,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.deletedAt || row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.status !== "ACTIVE") return null;

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    name: row.name,
    jobTitle: row.jobTitle,
    badgeNumber: row.badgeNumber,
    avatarUrl: row.avatarUrl,
    status: row.status,
    departmentId: row.departmentId,
    mfaEnabled: row.mfaEnabled,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt,
    sessionExpiresAt: row.expiresAt,
  };
}

/** Best-effort cleanup of expired sessions (called opportunistically). */
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
}
