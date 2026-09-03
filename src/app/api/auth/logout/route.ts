import { NextResponse, type NextRequest } from "next/server";

import { clearSessionCookie, revokeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { getOptionalContext } from "@/server/context";
import { recordAudit } from "@/server/audit/audit";
import { route } from "@/server/api/handler";
import { requirePasswordAuth } from "@/lib/auth/operator";

export const POST = route(async (request: NextRequest) => {
  requirePasswordAuth();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const context = getOptionalContext();
  if (token) await revokeSession(token);
  if (context) {
    await recordAudit({ action: "auth.logout", resourceType: "user", resourceId: context.user.id, summary: `${context.user.username} signed out` });
  }
  const response = NextResponse.json({ data: { ok: true } });
  clearSessionCookie(response, request.headers);
  return response;
});
