import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { roleService } from "@/server/services/roles";

const createSchema = z.object({
  key: z.string().trim().min(2),
  name: z.string().trim().min(2),
  description: z.string().nullish(),
  permissionKeys: z.array(z.string()).default([]),
});

export const GET = authRoute(async (_request, context) => ok({ rows: await roleService.list(context) }));

export const POST = authRoute(async (request, context) => {
  const body = createSchema.parse(await request.json().catch(() => ({})));
  return ok(await roleService.create(context, body), undefined, 201);
});
