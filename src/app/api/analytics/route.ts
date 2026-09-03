import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { analyticsService } from "@/server/services/analytics";

/** GET /api/analytics?metrics=a,b&trend=true&priority=true */
export const GET = authRoute(async (request, context) => {
  const url = new URL(request.url);
  const parsed = z
    .object({ metrics: z.string().default(""), trend: z.enum(["true", "false"]).default("false"), priority: z.enum(["true", "false"]).default("false") })
    .parse(Object.fromEntries(url.searchParams));

  const keys = parsed.metrics ? parsed.metrics.split(",").filter(Boolean) : ["activeIncidents", "openTasks", "activeUnits", "pendingReports", "overdueTasks", "evidenceInCustody", "activeAlerts", "incidentsThisWeek"];

  const [metrics, trend, priority, activity] = await Promise.all([
    analyticsService.metrics(context, keys),
    parsed.trend === "true" ? analyticsService.incidentTrend(context) : Promise.resolve([]),
    parsed.priority === "true" ? analyticsService.incidentPriorityDistribution(context) : Promise.resolve([]),
    analyticsService.recentActivity(context, 12),
  ]);

  return ok({ metrics, trend, priority, activity });
});
