import { alertService } from "@/server/services/notices";
import { collectionRoutes } from "@/server/api/resource-routes";
import { alertUpsertSchema } from "@/lib/validation/records";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => alertService.list(ctx, params),
  create: { schema: alertUpsertSchema, permission: "alerts.create", handler: (ctx, input) => alertService.create(ctx, input as never) },
});
