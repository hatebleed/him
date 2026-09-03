import { AppError } from "@/lib/errors";
import { authRoute, ok, param } from "@/server/api/handler";
import { incidentService } from "@/server/services/incidents";
import { assignUnitSchema } from "@/lib/validation/operations";

export const POST = authRoute<{ id: string }>(async (request, context) => {
  const incidentId = await param(context.segment, "id" as never);
  const body = assignUnitSchema.parse(await request.json().catch(() => ({})));
  if (!body.unitId && !body.userId) throw AppError.badRequest("Assign a unit or a user.");
  return ok(await incidentService.assign(context, incidentId, body), undefined, 201);
});

export const DELETE = authRoute<{ id: string }>(async (request, context) => {
  const incidentId = await param(context.segment, "id" as never);
  const assignmentId = new URL(request.url).searchParams.get("assignmentId");
  if (!assignmentId) throw AppError.badRequest("An assignmentId query parameter is required.");
  return ok(await incidentService.unassign(context, incidentId, assignmentId));
});
