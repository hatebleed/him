import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { AppError } from "@/lib/errors";
import { ok, route } from "@/server/api/handler";
import { recordAudit } from "@/server/audit/audit";
import { revokeAllSessions } from "@/lib/auth/session";
import { requirePasswordAuth } from "@/lib/auth/operator";

const schema = z.object({ token: z.string().min(10), password: z.string().min(8) });

/** POST /api/auth/reset - completes a password reset with a valid token. */
export const POST = route(async (request) => {
  requirePasswordAuth();
  const body = schema.parse(await request.json().catch(() => ({})));
  const [tokenRow] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, hashToken(body.token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
    .limit(1);

  if (!tokenRow) throw AppError.badRequest("This reset link is invalid or has expired.");
  const policy = validatePasswordPolicy(body.password);
  if (!policy.valid) throw AppError.badRequest(`Password does not meet the policy: ${policy.issues.join(" ")}`);

  const passwordHash = await hashPassword(body.password);
  await db.update(users).set({ passwordHash, passwordUpdatedAt: new Date(), mustChangePassword: false, failedLogins: 0, lockedUntil: null }).where(eq(users.id, tokenRow.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenRow.id));
  await revokeAllSessions(tokenRow.userId);
  await recordAudit({ action: "auth.password.reset_completed", resourceType: "user", resourceId: tokenRow.userId, summary: "Password reset completed" });

  return ok({ ok: true });
});
