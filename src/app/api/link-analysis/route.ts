import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { linkAnalysisService } from "@/server/services/link-analysis";

const query = z.object({
  type: z.enum(["person", "vehicle", "incident", "case", "evidence"]),
  id: z.string().min(1),
  depth: z.coerce.number().int().min(1).max(2).default(1),
});

/** GET /api/link-analysis?type=person&id=…&depth=2 - association graph around a record. */
export const GET = authRoute(async (request, context) => {
  const url = new URL(request.url);
  const parsed = query.parse({
    type: url.searchParams.get("type") ?? "",
    id: url.searchParams.get("id") ?? "",
    depth: url.searchParams.get("depth") ?? undefined,
  });
  return ok(await linkAnalysisService.graph(context, parsed));
});
