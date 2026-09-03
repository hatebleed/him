import { authRoute, ok, param } from "@/server/api/handler";
import { alertService } from "@/server/services/notices";

export const POST = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await alertService.acknowledge(context, id));
});
