import { z } from "zod";

import { authRoute, ok, param } from "@/server/api/handler";
import { userService } from "@/server/services/users";

/** POST /api/admin/users/:id/password - resets a password and revokes sessions. */
export const POST = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = z.object({ password: z.string().optional() }).parse(await request.json().catch(() => ({})));
  return ok(await userService.resetPassword(context, id, body.password));
});
