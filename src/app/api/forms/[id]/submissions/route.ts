import { authRoute, ok, param } from "@/server/api/handler";
import { formService } from "@/server/services/forms";

export const GET = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok({ rows: await formService.submissions(context, id) });
});
