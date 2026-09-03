import { z } from "zod";

import { AppError } from "@/lib/errors";
import { authRoute, ok } from "@/server/api/handler";
import { getTheme, invalidateConfiguration, updateTheme } from "@/server/configuration/service";
import { recordAudit } from "@/server/audit/audit";

const schema = z.object({
  mode: z.string().optional(),
  accentColour: z.string().optional(),
  density: z.string().optional(),
  radius: z.string().optional(),
  sidebarStyle: z.string().optional(),
  fontFamily: z.string().optional(),
  motion: z.string().optional(),
});

export const GET = authRoute(async (_request, _context) => ok(await getTheme()));

export const PUT = authRoute(async (request, context) => {
  if (!context.permissions.has("admin.themes.manage")) throw AppError.forbidden();
  const body = schema.parse(await request.json().catch(() => ({})));
  const updated = await updateTheme(body);
  invalidateConfiguration("theme");
  await recordAudit({ action: "config.theme.updated", resourceType: "theme", summary: "Updated interface theme", newValue: body });
  return ok(updated);
});
