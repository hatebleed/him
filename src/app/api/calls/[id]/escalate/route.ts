import { authRoute, ok, param } from "@/server/api/handler";
import { callService } from "@/server/services/dispatch";

/** POST /api/calls/:id/escalate - creates an incident from a call. */
export const POST = authRoute<{ id: string }>(async (_request, context) => {
  const callId = await param(context.segment, "id" as never);
  return ok(await callService.escalate(context, callId), undefined, 201);
});
