import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { searchService } from "@/server/search/service";

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  types: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

/** GET /api/search?q=... - only returns records the user may open. */
export const GET = authRoute(async (request, context) => {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return ok({ rows: [] });
  const { q, types, status, limit } = parsed.data;
  const rows = await searchService.search(
    context,
    q,
    { types: types ? types.split(",").filter(Boolean) : undefined, status: status ? status.split(",").filter(Boolean) : undefined, limit },
  );
  return ok({ rows, query: q });
});

export const POST = authRoute(async (request, context) => {
  const body = z.object({ query: z.string().min(2), filters: z.record(z.unknown()).optional() }).parse(await request.json().catch(() => ({})));
  return ok(await searchService.save(context, body.query, (body.filters ?? {}) as never));
});
