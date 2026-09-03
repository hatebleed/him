import { authRoute, ok } from "@/server/api/handler";
import { dispatchProvider } from "@/server/dispatch/provider";

/**
 * GET /api/dispatch
 * Live dispatch board: active calls and all units, served through the
 * pluggable dispatch provider.
 */
export const GET = authRoute(async (_request, context) => {
  const [calls, units] = await Promise.all([dispatchProvider.getActiveCalls(), dispatchProvider.getUnits()]);
  return ok({ calls, units, provider: dispatchProvider.name, viewer: { id: context.user.id, name: context.user.name } });
});
