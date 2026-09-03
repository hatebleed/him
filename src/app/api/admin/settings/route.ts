import { z } from "zod";

import { AppError } from "@/lib/errors";
import { authRoute, ok } from "@/server/api/handler";
import { listSettings, setSetting } from "@/server/configuration/service";
import { recordAudit } from "@/server/audit/audit";

const schema = z.object({ key: z.string().min(1), value: z.unknown(), description: z.string().optional() });

export const GET = authRoute(async (_request, context) => {
  if (!context.permissions.has("admin.settings.manage")) throw AppError.forbidden();
  return ok({ rows: await listSettings() });
});

export const PUT = authRoute(async (request, context) => {
  if (!context.permissions.has("admin.settings.manage")) throw AppError.forbidden();
  const body = schema.parse(await request.json().catch(() => ({})));
  await setSetting(body.key, body.value as never, body.description);
  await recordAudit({ action: "config.setting.updated", resourceType: "setting", resourceId: body.key, summary: `Updated setting ${body.key}`, newValue: { value: body.value } });
  return ok({ rows: await listSettings() });
});

