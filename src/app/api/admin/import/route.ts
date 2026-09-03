import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { importService } from "@/server/services/import-export";

const schema = z.object({
  resourceType: z.string().min(1),
  mapping: z.record(z.string()),
  rows: z.array(z.record(z.unknown())).min(1).max(5000),
  mode: z.enum(["preview", "commit"]).default("preview"),
});

export const GET = authRoute(async (_request, context) => ok({ rows: await importService.definitions(context) }));

/**
 * POST /api/admin/import
 * mode=preview validates and reports errors; mode=commit writes the rows.
 * Nothing is inserted without passing validation first.
 */
export const POST = authRoute(async (request, context) => {
  const body = schema.parse(await request.json().catch(() => ({})));
  if (body.mode === "preview") return ok(await importService.preview(context, body.resourceType, body.mapping, body.rows));
  return ok(await importService.commit(context, body.resourceType, body.mapping, body.rows));
});
