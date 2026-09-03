import { vehicleService } from "@/server/services/vehicles";
import { detailRoutes } from "@/server/api/resource-routes";
import { vehicleUpsertSchema } from "@/lib/validation/people";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => vehicleService.get(ctx, id),
  update: { schema: vehicleUpsertSchema, permission: "vehicles.edit", handler: (ctx, id, input) => vehicleService.update(ctx, id, input as never) },
  remove: { permission: "vehicles.delete", handler: (ctx, id) => vehicleService.remove(ctx, id) },
});
