import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { notificationService } from "@/server/notifications/service";

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), unread: z.enum(["true", "false"]).optional() });

/** GET /api/notifications - the signed-in user's notifications only. */
export const GET = authRoute(async (request, context) => {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  const options = parsed.success ? parsed.data : { limit: 30, unread: undefined };
  const rows = await notificationService.listForUser(context.user.id, {
    limit: options.limit,
    unreadOnly: options.unread === "true",
  });
  return ok({ rows, unread: await notificationService.countUnread(context.user.id) });
});
