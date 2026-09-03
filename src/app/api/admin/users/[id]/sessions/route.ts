import { authRoute, ok, param } from "@/server/api/handler";
import { userService } from "@/server/services/users";

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await userService.revokeSessions(context, id));
});
