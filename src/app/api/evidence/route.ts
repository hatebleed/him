import { evidenceService } from "@/server/services/evidence";
import { collectionRoutes } from "@/server/api/resource-routes";
import { evidenceUpsertSchema } from "@/lib/validation/records";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => evidenceService.list(ctx, params),
  create: { schema: evidenceUpsertSchema, permission: "evidence.create", handler: (ctx, input) => evidenceService.create(ctx, input as never) },
});
