import { incidentService } from "@/server/services/incidents";
import { detailRoutes } from "@/server/api/resource-routes";
import { incidentUpsertSchema } from "@/lib/validation/operations";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => incidentService.get(ctx, id),
  update: { schema: incidentUpsertSchema, permission: "incidents.edit", handler: (ctx, id, input) => incidentService.update(ctx, id, input as never) },
  remove: { permission: "incidents.delete", handler: (ctx, id) => incidentService.remove(ctx, id) },
});
