import { AppError } from "@/lib/errors";
import { authRoute, ok, param } from "@/server/api/handler";
import { incidentService } from "@/server/services/incidents";
import { incidentLinkPersonSchema, incidentLinkVehicleSchema } from "@/lib/validation/operations";

/**
 * POST /api/incidents/:id/links  { kind: "person" | "vehicle", ... }
 * DELETE /api/incidents/:id/links?kind=person&targetId=...
 */
export const POST = authRoute<{ id: string }>(async (request, context) => {
  const incidentId = await param(context.segment, "id" as never);
  const body = (await request.json().catch(() => ({}))) as { kind?: string } & Record<string, unknown>;
  if (body.kind === "person") {
    const parsed = incidentLinkPersonSchema.parse(body);
    return ok(await incidentService.linkPerson(context, incidentId, parsed), undefined, 201);
  }
  if (body.kind === "vehicle") {
    const parsed = incidentLinkVehicleSchema.parse(body);
    return ok(await incidentService.linkVehicle(context, incidentId, parsed), undefined, 201);
  }
  throw AppError.badRequest("Provide kind as 'person' or 'vehicle'.");
});

export const DELETE = authRoute<{ id: string }>(async (request, context) => {
  const incidentId = await param(context.segment, "id" as never);
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const targetId = url.searchParams.get("targetId");
  if (!targetId) throw AppError.badRequest("A targetId query parameter is required.");
  if (kind === "person") return ok(await incidentService.unlinkPerson(context, incidentId, targetId));
  if (kind === "vehicle") return ok(await incidentService.unlinkVehicle(context, incidentId, targetId));
  throw AppError.badRequest("Provide kind as 'person' or 'vehicle'.");
});
