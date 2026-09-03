import { authRoute, ok } from "@/server/api/handler";
import { dashboardService } from "@/server/services/dashboards";

/** POST /api/dashboard/reset - restores the default widget layout. */
export const POST = authRoute(async (_request, context) => ok(await dashboardService.reset(context)));
