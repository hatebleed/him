import { warrantService } from "@/server/services/notices";
import { collectionRoutes } from "@/server/api/resource-routes";
import { warrantUpsertSchema } from "@/lib/validation/records";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => warrantService.list(ctx, params),
  create: { schema: warrantUpsertSchema, permission: "warrants.create", handler: (ctx, input) => warrantService.create(ctx, input as never) },
});
