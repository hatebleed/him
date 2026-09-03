import { boloService } from "@/server/services/notices";
import { detailRoutes } from "@/server/api/resource-routes";
import { boloUpsertSchema } from "@/lib/validation/records";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => boloService.get(ctx, id),
  update: { schema: boloUpsertSchema, permission: "bolos.edit", handler: (ctx, id, input) => boloService.update(ctx, id, input as never) },
  remove: { permission: "bolos.delete", handler: (ctx, id) => boloService.remove(ctx, id) },
});
