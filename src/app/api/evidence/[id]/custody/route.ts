import { authRoute, ok, param } from "@/server/api/handler";
import { evidenceService } from "@/server/services/evidence";
import { evidenceTransferSchema } from "@/lib/validation/records";

/** POST /api/evidence/:id/custody - appends an immutable custody event. */
export const POST = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = evidenceTransferSchema.parse(await request.json().catch(() => ({})));
  return ok(await evidenceService.transfer(context, id, body), undefined, 201);
});
