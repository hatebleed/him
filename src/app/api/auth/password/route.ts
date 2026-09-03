import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import { authRoute } from "@/server/api/handler";
import { recordAudit } from "@/server/audit/audit";
import { revokeAllSessions } from "@/lib/auth/session";
import { requirePasswordAuth } from "@/lib/auth/operator";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(1, "Enter a new password."),
});

/** POST /api/auth/password - change the signed-in user's own password. */
export const POST = authRoute(async (request, context) => {
  requirePasswordAuth();
  const body = schema.parse(await request.json().catch(() => ({})));
  const [account] = await db.select().from(users).where(eq(users.id, context.user.id)).limit(1);
  if (!account) throw AppError.unauthenticated();

  const valid = await verifyPassword(body.currentPassword, account.passwordHash);
  if (!valid) throw AppError.badRequest("Your current password is incorrect.");

  const policy = validatePasswordPolicy(body.newPassword);
  if (!policy.valid) throw AppError.badRequest(`Password does not meet the policy: ${policy.issues.join(" ")}`);

  const passwordHash = await hashPassword(body.newPassword);
  await db
    .update(users)
    .set({ passwordHash, passwordUpdatedAt: new Date(), mustChangePassword: false })
    .where(eq(users.id, context.user.id));

  // Other devices should not keep the old session alive.
  await revokeAllSessions(context.user.id);
  await recordAudit({ action: "auth.password.changed", resourceType: "user", resourceId: context.user.id, summary: "Password changed" });

  return Response.json({ data: { ok: true } });
});
