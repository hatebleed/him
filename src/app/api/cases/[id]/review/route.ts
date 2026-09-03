import { authRoute, ok, param } from "@/server/api/handler";
import { caseService } from "@/server/services/cases";
import { caseReviewSchema } from "@/lib/validation/operations";

export const POST = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = caseReviewSchema.parse(await request.json().catch(() => ({})));
  return ok(await caseService.review(context, id, body.status, body.reviewNotes));
});
