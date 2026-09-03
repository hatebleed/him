import { authRoute, ok, param } from "@/server/api/handler";
import { unitService } from "@/server/services/units";
import { unitStatusSchema } from "@/lib/validation/operations";

export const POST = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = unitStatusSchema.parse(await request.json().catch(() => ({})));
  return ok(await unitService.setStatus(context, id, body.status, body.note, body.location));
});
