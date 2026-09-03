import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { notificationService } from "@/server/notifications/service";

const schema = z.object({ category: z.string().min(1), inApp: z.boolean().optional(), email: z.boolean().optional() });

export const GET = authRoute(async (_request, context) => ok({ rows: await notificationService.preferences(context.user.id) }));

export const PUT = authRoute(async (request, context) => {
  const body = schema.parse(await request.json().catch(() => ({})));
  const row = await notificationService.setPreference(context.user.id, body.category, { inApp: body.inApp, email: body.email });
  return ok({ row });
});
