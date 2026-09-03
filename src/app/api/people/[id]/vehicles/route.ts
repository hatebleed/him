import { AppError } from "@/lib/errors";
import { authRoute, ok, param } from "@/server/api/handler";
import { peopleService } from "@/server/services/people";
import { personLinkVehicleSchema } from "@/lib/validation/people";

/** POST /api/people/:id/vehicles - link a vehicle to the person. */
export const POST = authRoute<{ id: string }>(async (request, context) => {
  const personId = await param(context.segment, "id" as never);
  const body = personLinkVehicleSchema.parse(await request.json().catch(() => ({})));
  return ok(await peopleService.linkVehicle(context, personId, body), undefined, 201);
});

/** DELETE /api/people/:id/vehicles?vehicleId=... */
export const DELETE = authRoute<{ id: string }>(async (request, context) => {
  const personId = await param(context.segment, "id" as never);
  const vehicleId = new URL(request.url).searchParams.get("vehicleId");
  if (!vehicleId) throw AppError.badRequest("A vehicleId query parameter is required.");
  return ok(await peopleService.unlinkVehicle(context, personId, vehicleId));
});
