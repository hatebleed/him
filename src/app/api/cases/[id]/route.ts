import { caseService } from "@/server/services/cases";
import { detailRoutes } from "@/server/api/resource-routes";
import { caseUpsertSchema } from "@/lib/validation/operations";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => caseService.get(ctx, id),
  update: { schema: caseUpsertSchema, permission: "cases.edit", handler: (ctx, id, input) => caseService.update(ctx, id, input as never) },
  remove: { permission: "cases.delete", handler: (ctx, id) => caseService.remove(ctx, id) },
});
