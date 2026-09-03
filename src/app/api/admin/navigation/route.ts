import { z } from "zod";

import { AppError } from "@/lib/errors";
import { authRoute, ok } from "@/server/api/handler";
import {
  getNavigation,
  navigationItemSchema,
  setNavigationEnabled,
  upsertNavigationItem,
  deleteNavigationItem,
  invalidateConfiguration,
} from "@/server/configuration/service";
import { recordAudit } from "@/server/audit/audit";

const itemSchema = navigationItemSchema;

export const GET = authRoute(async (_request, _context) => ok({ rows: await getNavigation() }));

export const PUT = authRoute(async (request, context) => {
  if (!context.permissions.has("admin.navigation.manage")) throw AppError.forbidden();
  const body = itemSchema.parse(await request.json().catch(() => ({})));
  await upsertNavigationItem(body);
  invalidateConfiguration("navigation");
  await recordAudit({ action: "config.navigation.updated", resourceType: "navigation", resourceId: body.key, summary: `Saved navigation item ${body.label}` });
  return ok({ rows: await getNavigation() });
});

export const PATCH = authRoute(async (request, context) => {
  if (!context.permissions.has("admin.navigation.manage")) throw AppError.forbidden();
  const body = z.object({ key: z.string().min(1), enabled: z.boolean() }).parse(await request.json().catch(() => ({})));
  await setNavigationEnabled(body.key, body.enabled);
  invalidateConfiguration("navigation");
  return ok({ rows: await getNavigation() });
});

export const DELETE = authRoute(async (request, context) => {
  if (!context.permissions.has("admin.navigation.manage")) throw AppError.forbidden();
  const key = new URL(request.url).searchParams.get("key");
  if (!key) throw AppError.badRequest("A key query parameter is required.");
  await deleteNavigationItem(key);
  invalidateConfiguration("navigation");
  await recordAudit({ action: "config.navigation.deleted", resourceType: "navigation", resourceId: key, summary: "Deleted navigation item" });
  return ok({ rows: await getNavigation() });
});
