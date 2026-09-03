import { authRoute, ok } from "@/server/api/handler";
import { getShellConfiguration } from "@/server/configuration/service";
import { notificationService } from "@/server/notifications/service";
import { taskService } from "@/server/services/tasks";
import { authMode } from "@/lib/auth/operator";

/**
 * GET /api/shell
 * Everything the application shell needs in one request: identity,
 * permissions, configuration, navigation, branding and notification counts.
 */
export const GET = authRoute(async (_request, context) =>
  ok({
    user: context.user,
    permissions: [...context.permissions],
    roles: context.roles,
    security: { authMode: authMode() },
    config: await getShellConfiguration(),
    notifications: {
      unread: await notificationService.countUnread(context.user.id),
      recent: await notificationService.listForUser(context.user.id, { limit: 8 }),
    },
    tasks: {
      mine: await taskService.mine(context, 5),
    },
  }),
);
