import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { briefingService } from "@/server/services/briefing";

const query = z.object({ hours: z.coerce.number().int().min(1).max(72).default(12) });

/** GET /api/briefing?hours=12 - generated shift briefing for roll call. */
export const GET = authRoute(async (request, context) => {
  const url = new URL(request.url);
  const parsed = query.parse({ hours: url.searchParams.get("hours") ?? undefined });
  return ok(await briefingService.generate(context, { hours: parsed.hours }));
});
