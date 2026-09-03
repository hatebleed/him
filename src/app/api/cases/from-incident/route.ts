import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { caseService } from "@/server/services/cases";

/** POST /api/cases/from-incident - promotes an incident into a case. */
export const POST = authRoute(async (request, context) => {
  const body = z.object({ incidentId: z.string().min(1) }).parse(await request.json().catch(() => ({})));
  return ok(await caseService.createFromIncident(context, body.incidentId), undefined, 201);
});
