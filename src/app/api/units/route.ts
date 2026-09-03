import { unitService } from "@/server/services/units";
import { collectionRoutes } from "@/server/api/resource-routes";
import { unitUpsertSchema } from "@/lib/validation/operations";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => unitService.list(ctx, params),
  create: { schema: unitUpsertSchema, permission: "admin.units.manage", handler: (ctx, input) => unitService.create(ctx, input as never) },
});
