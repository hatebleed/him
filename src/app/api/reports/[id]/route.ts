import { reportService } from "@/server/services/reports";
import { detailRoutes } from "@/server/api/resource-routes";
import { reportUpsertSchema } from "@/lib/validation/records";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => reportService.get(ctx, id),
  update: { schema: reportUpsertSchema, permission: "reports.edit", handler: (ctx, id, input) => reportService.update(ctx, id, input as never) },
  remove: { permission: "reports.delete", handler: (ctx, id) => reportService.remove(ctx, id) },
});
