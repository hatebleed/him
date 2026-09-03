import { authRoute, ok, param } from "@/server/api/handler";
import { incidentService } from "@/server/services/incidents";
import { incidentStatusSchema } from "@/lib/validation/operations";

/** POST /api/incidents/:id/status - records a timeline entry and audit event. */
export const POST = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = incidentStatusSchema.parse(await request.json().catch(() => ({})));
  return ok(await incidentService.changeStatus(context, id, body.status, body.note));
});
