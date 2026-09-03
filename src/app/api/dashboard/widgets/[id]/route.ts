import { authRoute, ok, param } from "@/server/api/handler";
import { dashboardService } from "@/server/services/dashboards";

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id");
  return ok(await dashboardService.removeWidget(context, id));
});
