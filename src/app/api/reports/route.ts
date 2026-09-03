import { reportService } from "@/server/services/reports";
import { collectionRoutes } from "@/server/api/resource-routes";
import { reportUpsertSchema } from "@/lib/validation/records";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => reportService.list(ctx, params),
  create: { schema: reportUpsertSchema, permission: "reports.create", handler: (ctx, input) => reportService.create(ctx, input as never) },
});
