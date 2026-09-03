import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { applySessionCookie, createSession, purgeExpiredSessions, revokeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { route } from "@/server/api/handler";
import { recordAudit } from "@/server/audit/audit";
import { requirePasswordAuth } from "@/lib/auth/operator";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean().optional().default(false),
});

/**
 * POST /api/auth/login
 * Verifies credentials, enforces lockout and account state, issues a session
 * cookie and records the authentication event in the audit trail.
 */
export const POST = route(async (request: NextRequest) => {
  requirePasswordAuth();
  const body = loginSchema.parse(await request.json().catch(() => ({})));
  const identifier = body.identifier.toLowerCase();

  const [user] = await db
    .select()
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.email, identifier)))
    .limit(1);

  const [byUsername] = user ? [user] : await db.select().from(users).where(and(isNull(users.deletedAt), eq(users.username, identifier))).limit(1);
  const account = user ?? byUsername;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");

  if (!account) {
    logger.warn("Failed sign-in: unknown account", { identifier, ip });
    throw AppError.unauthenticated("Those credentials do not match an active account.");
  }

  if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
    throw AppError.locked();
  }

  const valid = await verifyPassword(body.password, account.passwordHash);
  if (!valid) {
    const attempts = account.failedLogins + 1;
    const shouldLock = attempts >= env.MAX_FAILED_LOGINS;
    await db
      .update(users)
      .set({
        failedLogins: attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + env.ACCOUNT_LOCKOUT_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, account.id));
    logger.warn("Failed sign-in: bad password", { userId: account.id, ip, attempts });
    await recordAudit({
      action: "auth.login.failed",
      resourceType: "user",
      resourceId: account.id,
      summary: `Failed sign-in attempt (${attempts})`,
      metadata: { ip, userAgent },
    });
    throw AppError.unauthenticated("Those credentials do not match an active account.");
  }

  if (account.status !== "ACTIVE") {
    throw AppError.forbidden("This account is not active. Contact an administrator.");
  }

  await db
    .update(users)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(), lastActiveAt: new Date() })
    .where(eq(users.id, account.id));

  const { token, expiresAt } = await createSession(account.id, { ip, userAgent });
  await purgeExpiredSessions();

  await recordAudit({
    action: "auth.login",
    resourceType: "user",
    resourceId: account.id,
    summary: `${account.username} signed in`,
    metadata: { ip, userAgent },
  });

  const response = NextResponse.json({
    data: {
      id: account.id,
      name: account.name,
      username: account.username,
      email: account.email,
      mustChangePassword: account.mustChangePassword,
      sessionExpiresAt: expiresAt,
    },
  });
  const cookiePolicy = applySessionCookie(response, token, expiresAt, request.headers);
  logger.info("Session issued", {
    userId: account.id,
    scheme: cookiePolicy.scheme,
    secure: cookiePolicy.secure,
    sameSite: cookiePolicy.sameSite,
    crossSite: cookiePolicy.crossSite,
    origin: request.headers.get("origin"),
  });
  return response;
});

/** Removes the current session cookie. */
export const DELETE = route(async (request: NextRequest) => {
  requirePasswordAuth();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});
