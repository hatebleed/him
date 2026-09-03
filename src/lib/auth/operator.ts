import "server-only";

import { and, eq, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";

import type { AuthenticatedUser } from "./session";

/**
 * Identity for deployments that have no sign-in (`AUTH_MODE=none`).
 *
 * There is no anonymous access and no built-in superuser: every request is
 * attributed to a real account (`OPERATOR_USER`) and carries that account's
 * roles and permissions, resolved from the database exactly as they are after a
 * password sign-in. Authorisation, auditing, workflows and notifications are
 * therefore unchanged - only the credential prompt is gone.
 */

/** The authentication mode this deployment runs in. */
export function authMode(): "none" | "password" {
  return env.AUTH_MODE;
}

/** True when accounts sign in with a password. */
export function passwordAuthEnabled(): boolean {
  return env.AUTH_MODE === "password";
}

/**
 * Throws a 404 from any credential route when the deployment has no sign-in,
 * so the endpoints do not exist as an attack surface.
 */
export function requirePasswordAuth(): void {
  if (passwordAuthEnabled()) return;
  throw new AppError({
    code: "AUTH_DISABLED",
    status: 404,
    message: "This deployment has no sign-in (AUTH_MODE=none).",
  });
}

/** Cache window for the operator record: short enough to notice role changes. */
const CACHE_MS = 5_000;

let cached: { key: string; user: AuthenticatedUser; expiresAt: number } | null = null;

/**
 * Loads the account every request runs as.
 *
 * Throws a loud, actionable error when it is missing or disabled rather than
 * silently granting nothing, because a misconfigured operator is a
 * configuration mistake, not a permission decision.
 */
export async function loadOperator(): Promise<AuthenticatedUser> {
  const identifier = env.OPERATOR_USER.trim().toLowerCase();
  if (cached && cached.key === identifier && cached.expiresAt > Date.now()) return cached.user;

  const [row] = await db
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
    })
    .from(users)
    .where(and(isNull(users.deletedAt), or(eq(users.email, identifier), eq(users.username, identifier))))
    .limit(1);

  if (!row || row.status !== "ACTIVE") {
    throw new AppError({
      code: "OPERATOR_UNAVAILABLE",
      status: 500,
      message: `AUTH_MODE=none needs an active account named by OPERATOR_USER ("${env.OPERATOR_USER}"). It was not found or is not active.`,
    });
  }

  const user: AuthenticatedUser = {
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
    // There is no session to expire in this mode.
    sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  cached = { key: identifier, user, expiresAt: Date.now() + CACHE_MS };
  return user;
}

/** Drops the cached operator record (used after identity changes in tests). */
export function clearOperatorCache(): void {
  cached = null;
}
