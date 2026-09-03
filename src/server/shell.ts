import "server-only";

import { getShellConfiguration } from "./configuration/service";
import { notificationService } from "./notifications/service";
import { taskService } from "./services/tasks";
import { authMode } from "@/lib/auth/operator";
import type { RequestContext } from "./context";

export type ShellPayload = Awaited<ReturnType<typeof getShellData>>;

/**
 * Server-side equivalent of `GET /api/shell`.
 * The application shell uses this to render the first paint with real data
 * instead of flashing empty chrome and fetching afterwards.
 */
export async function getShellData(context: RequestContext) {
  const [config, unread, recent, tasks] = await Promise.all([
    getShellConfiguration(),
    notificationService.countUnread(context.user.id),
    notificationService.listForUser(context.user.id, { limit: 8 }),
    taskService.mine(context, 5),
  ]);

  return {
    user: context.user,
    permissions: [...context.permissions],
    roles: context.roles,
    security: { authMode: authMode() },
    config,
    notifications: { unread, recent },
    tasks: { mine: tasks },
  };
}
