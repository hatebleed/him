import { type NextRequest } from "next/server";

import { resolveOptionalContext } from "@/server/context";
import { authMode } from "@/lib/auth/operator";
import { ok, route } from "@/server/api/handler";
import { loadUserPermissions } from "@/server/permissions/service";
import { getModules, getNavigation, getTerminology, getBranding, getTheme } from "@/server/configuration/service";
import { requirePasswordAuth } from "@/lib/auth/operator";

/** Returns the current security context (or null) plus shell configuration. */
export const GET = route(async (request: NextRequest) => {
  requirePasswordAuth();
  const context = await resolveOptionalContext(request);
  if (!context) return ok({ user: null, permissions: [], roles: [], config: null, security: { authMode: authMode() } });

  const permissions = await loadUserPermissions(context.user.id);
  const [modules, navigation, terminology, branding, theme] = await Promise.all([
    getModules(),
    getNavigation(),
    getTerminology(),
    getBranding(),
    getTheme(),
  ]);

  return ok({
    user: context.user,
    permissions: [...permissions.permissions],
    roles: permissions.roles,
    config: { modules, navigation, terminology, branding, theme },
    security: { authMode: authMode() },
  });
});
