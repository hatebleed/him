import { alertService } from "@/server/services/notices";
import { detailRoutes } from "@/server/api/resource-routes";
import { alertUpsertSchema } from "@/lib/validation/records";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => alertService.get(ctx, id),
  update: { schema: alertUpsertSchema, permission: "alerts.edit", handler: (ctx, id, input) => alertService.update(ctx, id, input as never) },
  remove: { permission: "alerts.delete", handler: (ctx, id) => alertService.remove(ctx, id) },
});
