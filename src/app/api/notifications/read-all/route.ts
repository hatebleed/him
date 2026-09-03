import { authRoute, ok } from "@/server/api/handler";
import { notificationService } from "@/server/notifications/service";

export const POST = authRoute(async (_request, context) => ok({ updated: await notificationService.markAllRead(context.user.id) }));
