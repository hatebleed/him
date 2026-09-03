import { callService } from "@/server/services/dispatch";
import { collectionRoutes } from "@/server/api/resource-routes";
import { callUpsertSchema } from "@/lib/validation/operations";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => callService.list(ctx, params),
  create: { schema: callUpsertSchema, permission: "calls.create", handler: (ctx, input) => callService.create(ctx, input as never) },
});
