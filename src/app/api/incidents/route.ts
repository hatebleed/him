import { incidentService } from "@/server/services/incidents";
import { collectionRoutes } from "@/server/api/resource-routes";
import { incidentUpsertSchema } from "@/lib/validation/operations";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => incidentService.list(ctx, params),
  create: { schema: incidentUpsertSchema, permission: "incidents.create", handler: (ctx, input) => incidentService.create(ctx, input as never) },
});
