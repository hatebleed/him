import { z } from "zod";

import { AppError } from "@/lib/errors";
import { authRoute, ok } from "@/server/api/handler";
import { getBranding, invalidateConfiguration, updateBranding } from "@/server/configuration/service";
import { recordAudit } from "@/server/audit/audit";

const schema = z.object({
  organisationName: z.string().min(1).optional(),
  organisationShort: z.string().nullish(),
  tagline: z.string().nullish(),
  contactEmail: z.string().nullish(),
  contactPhone: z.string().nullish(),
  address: z.string().nullish(),
  logoUrl: z.string().nullish(),
  faviconUrl: z.string().nullish(),
  loginBackgroundUrl: z.string().nullish(),
  primaryColour: z.string().optional(),
  accentColour: z.string().optional(),
  sidebarColour: z.string().optional(),
});

export const GET = authRoute(async (_request, _context) => ok(await getBranding()));

export const PUT = authRoute(async (request, context) => {
  if (!context.permissions.has("admin.branding.manage")) throw AppError.forbidden();
  const body = schema.parse(await request.json().catch(() => ({})));
  const updated = await updateBranding(body);
  invalidateConfiguration("branding");
  await recordAudit({ action: "config.branding.updated", resourceType: "organisation", summary: "Updated organisation branding", newValue: body });
  return ok(updated);
});
