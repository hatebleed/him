import { taskService } from "@/server/services/tasks";
import { collectionRoutes } from "@/server/api/resource-routes";
import { taskUpsertSchema } from "@/lib/validation/records";

export const { GET, POST } = collectionRoutes({
  list: (ctx, params) => taskService.list(ctx, params),
  create: { schema: taskUpsertSchema, permission: "tasks.create", handler: (ctx, input) => taskService.create(ctx, input as never) },
});
