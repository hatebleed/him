import { peopleService } from "@/server/services/people";
import { detailRoutes } from "@/server/api/resource-routes";
import { personUpsertSchema } from "@/lib/validation/people";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => peopleService.get(ctx, id),
  update: { schema: personUpsertSchema, permission: "people.edit", handler: (ctx, id, input) => peopleService.update(ctx, id, input as never) },
  remove: { permission: "people.delete", handler: (ctx, id) => peopleService.remove(ctx, id) },
});
