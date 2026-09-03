import { vehicleService } from "@/server/services/vehicles";
import { collectionRoutes } from "@/server/api/resource-routes";
import { vehicleUpsertSchema } from "@/lib/validation/people";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => vehicleService.list(ctx, params),
  create: { schema: vehicleUpsertSchema, permission: "vehicles.create", handler: (ctx, input) => vehicleService.create(ctx, input as never) },
});
