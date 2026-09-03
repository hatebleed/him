import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { AppError } from "@/lib/errors";
import { getModules, setModuleEnabled, invalidateConfiguration } from "@/server/configuration/service";
import { recordAudit } from "@/server/audit/audit";

export const GET = authRoute(async (_request, _context) => ok({ rows: await getModules() }));

/** PATCH /api/admin/modules - enable/disable modules (core modules protected). */
export const PATCH = authRoute(async (request, context) => {
  if (!context.permissions.has("admin.modules.manage")) throw AppError.forbidden();
  const body = z.object({ key: z.string().min(1), enabled: z.boolean() }).parse(await request.json().catch(() => ({})));
  await setModuleEnabled(body.key, body.enabled);
  invalidateConfiguration();
  await recordAudit({
    action: body.enabled ? "config.module.enabled" : "config.module.disabled",
    resourceType: "module",
    resourceId: body.key,
    summary: `${body.enabled ? "Enabled" : "Disabled"} module ${body.key}`,
  });
  return ok({ rows: await getModules() });
});
