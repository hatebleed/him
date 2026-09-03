import { unitService } from "@/server/services/units";
import { detailRoutes } from "@/server/api/resource-routes";
import { unitUpsertSchema } from "@/lib/validation/operations";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => unitService.get(ctx, id),
  update: { schema: unitUpsertSchema, permission: "admin.units.manage", handler: (ctx, id, input) => unitService.update(ctx, id, input as never) },
  remove: { permission: "admin.units.manage", handler: (ctx, id) => unitService.remove(ctx, id) },
});
