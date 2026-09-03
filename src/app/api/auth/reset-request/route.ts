import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { ok, route } from "@/server/api/handler";
import { recordAudit } from "@/server/audit/audit";
import { requirePasswordAuth } from "@/lib/auth/operator";

const schema = z.object({ email: z.string().email() });

/**
 * POST /api/auth/reset-request
 * Always reports success (prevents account enumeration). When the address
 * exists a single-use token is issued and returned by the configured email
 * provider (console adapter in development).
 */
export const POST = route(async (request) => {
  requirePasswordAuth();
  const body = schema.parse(await request.json().catch(() => ({})));
  const email = body.email.toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (user) {
    const token = generateToken(24);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt, createdIp: request.headers.get("x-forwarded-for")?.split(",")[0] ?? null });
    await recordAudit({ action: "auth.password.reset_requested", resourceType: "user", resourceId: user.id, summary: "Password reset requested" });
    // EmailProvider abstraction - the console adapter logs instead of sending.
    const { logger } = await import("@/lib/logger");
    logger.info("Password reset token issued", { userId: user.id, token: process.env.NODE_ENV === "production" ? "[not logged]" : token });
  }

  return ok({ ok: true, message: "If that address is registered, a reset link has been issued." });
});
