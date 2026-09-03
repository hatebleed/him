import { callService } from "@/server/services/dispatch";
import { detailRoutes } from "@/server/api/resource-routes";
import { callUpsertSchema } from "@/lib/validation/operations";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => callService.get(ctx, id),
  update: { schema: callUpsertSchema, permission: "calls.edit", handler: (ctx, id, input) => callService.update(ctx, id, input as never) },
});
