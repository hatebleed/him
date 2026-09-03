import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { getTerminology, invalidateConfiguration, setTerminology } from "@/server/configuration/service";
import { recordAudit } from "@/server/audit/audit";

const schema = z.object({ termKey: z.string().min(1), singular: z.string().min(1), plural: z.string().min(1) });

export const GET = authRoute(async (_request, _context) => ok({ rows: await getTerminology() }));

/** PUT /api/admin/terminology - renames a concept across the whole UI. */
export const PUT = authRoute(async (request, context) => {
  if (!context.permissions.has("admin.terminology.manage")) {
    const { AppError } = await import("@/lib/errors");
    throw AppError.forbidden();
  }
  const body = schema.parse(await request.json().catch(() => ({})));
  await setTerminology(body.termKey, body.singular, body.plural);
  invalidateConfiguration("terminology");
  await recordAudit({
    action: "config.terminology.updated",
    resourceType: "terminology",
    resourceId: body.termKey,
    summary: `Renamed ${body.termKey} to ${body.singular}/${body.plural}`,
    previousValue: { termKey: body.termKey },
    newValue: { singular: body.singular, plural: body.plural },
  });
  return ok({ rows: await getTerminology() });
});
