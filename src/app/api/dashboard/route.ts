import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { dashboardService } from "@/server/services/dashboards";

const layoutSchema = z.object({
  widgets: z.array(
    z.object({
      type: z.string().min(1),
      title: z.string().nullish(),
      config: z.unknown().optional(),
      size: z.string().optional(),
      visible: z.boolean().optional(),
      sortOrder: z.number().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      w: z.number().optional(),
      h: z.number().optional(),
    }),
  ),
});

export const GET = authRoute(async (_request, context) => ok(await dashboardService.get(context)));

export const PUT = authRoute(async (request, context) => {
  const body = layoutSchema.parse(await request.json().catch(() => ({})));
  return ok(await dashboardService.saveLayout(context, body.widgets));
});
