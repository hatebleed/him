import { warrantService } from "@/server/services/notices";
import { detailRoutes } from "@/server/api/resource-routes";
import { warrantUpsertSchema } from "@/lib/validation/records";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => warrantService.get(ctx, id),
  update: { schema: warrantUpsertSchema, permission: "warrants.edit", handler: (ctx, id, input) => warrantService.update(ctx, id, input as never) },
  remove: { permission: "warrants.delete", handler: (ctx, id) => warrantService.remove(ctx, id) },
});
