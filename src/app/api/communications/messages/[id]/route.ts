import { authRoute, ok, param } from "@/server/api/handler";
import { communicationService } from "@/server/services/communications";

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await communicationService.deleteMessage(context, id));
});
