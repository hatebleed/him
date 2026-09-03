import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { dashboardService } from "@/server/services/dashboards";

/** GET /api/dashboard/widgets - the catalogue of widgets the user may add. */
export const GET = authRoute(async (_request, context) => ok({ rows: await dashboardService.catalogue(context) }));

export const POST = authRoute(async (request, context) => {
  const body = z.object({ type: z.string().min(1) }).parse(await request.json().catch(() => ({})));
  return ok(await dashboardService.addWidget(context, body.type), undefined, 201);
});
