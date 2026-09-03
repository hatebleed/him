import { boloService } from "@/server/services/notices";
import { collectionRoutes } from "@/server/api/resource-routes";
import { boloUpsertSchema } from "@/lib/validation/records";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => boloService.list(ctx, params),
  create: { schema: boloUpsertSchema, permission: "bolos.create", handler: (ctx, input) => boloService.create(ctx, input as never) },
});
