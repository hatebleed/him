import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { departmentService } from "@/server/services/roles";

const createSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(2),
  description: z.string().nullish(),
  parentId: z.string().nullish(),
});

export const GET = authRoute(async (_request, context) => ok({ rows: await departmentService.list(context) }));

export const POST = authRoute(async (request, context) => {
  const body = createSchema.parse(await request.json().catch(() => ({})));
  return ok(await departmentService.create(context, body), undefined, 201);
});
