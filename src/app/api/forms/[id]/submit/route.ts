import { z } from "zod";

import { authRoute, ok, param } from "@/server/api/handler";
import { formService } from "@/server/services/forms";

/** POST /api/forms/:id/submit - validates and stores a form submission. */
export const POST = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = z
    .object({ data: z.record(z.unknown()), recordType: z.string().nullish(), recordId: z.string().nullish() })
    .parse(await request.json().catch(() => ({})));
  return ok(await formService.submit(context, id, body.data, { recordType: body.recordType ?? null, recordId: body.recordId ?? null }), undefined, 201);
});
