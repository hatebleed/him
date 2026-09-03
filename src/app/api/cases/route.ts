import { caseService } from "@/server/services/cases";
import { collectionRoutes } from "@/server/api/resource-routes";
import { caseUpsertSchema } from "@/lib/validation/operations";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => caseService.list(ctx, params),
  create: { schema: caseUpsertSchema, permission: "cases.create", handler: (ctx, input) => caseService.create(ctx, input as never) },
});
