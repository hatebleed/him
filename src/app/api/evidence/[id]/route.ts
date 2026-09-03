import { evidenceService } from "@/server/services/evidence";
import { detailRoutes } from "@/server/api/resource-routes";
import { evidenceUpsertSchema } from "@/lib/validation/records";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => evidenceService.get(ctx, id),
  update: { schema: evidenceUpsertSchema, permission: "evidence.edit", handler: (ctx, id, input) => evidenceService.update(ctx, id, input as never) },
  remove: { permission: "evidence.delete", handler: (ctx, id) => evidenceService.remove(ctx, id) },
});
