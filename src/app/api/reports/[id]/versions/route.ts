import { z } from "zod";

import { authRoute, ok, param } from "@/server/api/handler";
import { reportService } from "@/server/services/reports";

/** POST /api/reports/:id/versions - restores a previous version as a new one. */
export const POST = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = z.object({ version: z.coerce.number().int().positive() }).parse(await request.json().catch(() => ({})));
  return ok(await reportService.restoreVersion(context, id, body.version));
});
