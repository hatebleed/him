import { taskService } from "@/server/services/tasks";
import { detailRoutes } from "@/server/api/resource-routes";
import { taskUpsertSchema } from "@/lib/validation/records";

export const { GET, PATCH, DELETE } = detailRoutes({
  get: (ctx, id) => taskService.get(ctx, id),
  update: { schema: taskUpsertSchema, permission: "tasks.edit", handler: (ctx, id, input) => taskService.update(ctx, id, input as never) },
  remove: { permission: "tasks.delete", handler: (ctx, id) => taskService.remove(ctx, id) },
});
