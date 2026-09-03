import { authRoute, ok, param } from "@/server/api/handler";
import { taskService } from "@/server/services/tasks";
import { taskCommentSchema } from "@/lib/validation/records";

export const POST = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = taskCommentSchema.parse(await request.json().catch(() => ({})));
  return ok(await taskService.addComment(context, id, body.body), undefined, 201);
});
