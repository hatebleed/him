import { z } from "zod";

import { AppError } from "@/lib/errors";
import { authRoute, ok, param } from "@/server/api/handler";
import { callService } from "@/server/services/dispatch";

/** POST /api/calls/:id/units - assign / update a unit on a call. */
export const POST = authRoute<{ id: string }>(async (request, context) => {
  const callId = await param(context.segment, "id" as never);
  const body = z
    .object({ unitId: z.string().min(1), action: z.enum(["ASSIGN", "STATUS"]).default("ASSIGN"), status: z.string().optional() })
    .parse(await request.json().catch(() => ({})));

  if (body.action === "STATUS") {
    if (!body.status) throw AppError.badRequest("A status is required.");
    return ok(await callService.setUnitStatus(context, callId, body.unitId, body.status));
  }
  return ok(await callService.assignUnit(context, callId, body.unitId), undefined, 201);
});

export const DELETE = authRoute<{ id: string }>(async (request, context) => {
  const callId = await param(context.segment, "id" as never);
  const unitId = new URL(request.url).searchParams.get("unitId");
  if (!unitId) throw AppError.badRequest("A unitId query parameter is required.");
  return ok(await callService.unassignUnit(context, callId, unitId));
});
