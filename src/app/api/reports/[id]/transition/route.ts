import { authRoute, ok, param } from "@/server/api/handler";
import { reportService } from "@/server/services/reports";
import { reportTransitionSchema } from "@/lib/validation/records";

/**
 * POST /api/reports/:id/transition
 * Drives the configurable report lifecycle (submit, review, approve...).
 */
export const POST = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = reportTransitionSchema.parse(await request.json().catch(() => ({})));
  return ok(await reportService.transition(context, id, body.action, body.reason, body.changeNote));
});
