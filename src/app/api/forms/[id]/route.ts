import { authRoute, ok, param } from "@/server/api/handler";
import { formService, formUpdateSchema } from "@/server/services/forms";

export const GET = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await formService.get(context, id));
});

export const PATCH = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = formUpdateSchema.parse(await request.json().catch(() => ({})));
  return ok(await formService.update(context, id, body));
});

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await formService.remove(context, id));
});
