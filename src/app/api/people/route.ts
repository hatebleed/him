import { peopleService } from "@/server/services/people";
import { collectionRoutes } from "@/server/api/resource-routes";
import { personUpsertSchema } from "@/lib/validation/people";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => peopleService.list(ctx, params),
  create: { schema: personUpsertSchema, permission: "people.create", handler: (ctx, input) => peopleService.create(ctx, input as never) },
});
