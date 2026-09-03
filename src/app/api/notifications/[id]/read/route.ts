import { AppError } from "@/lib/errors";
import { authRoute, ok, param } from "@/server/api/handler";
import { notificationService } from "@/server/notifications/service";

/** POST /api/notifications/:id/read - scoped to the owner (IDOR safe). */
export const POST = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id");
  const updated = await notificationService.markRead(context.user.id, id);
  if (!updated) throw AppError.notFound("That notification does not exist.");
  return ok({ ok: true });
});
