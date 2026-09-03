import { z } from "zod";

import { authRoute, ok, param } from "@/server/api/handler";
import { departmentService } from "@/server/services/roles";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  code: z.string().trim().min(2).optional(),
  description: z.string().nullish(),
  active: z.boolean().optional(),
  parentId: z.string().nullish(),
});

export const PATCH = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = updateSchema.parse(await request.json().catch(() => ({})));
  return ok(await departmentService.update(context, id, body));
});

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await departmentService.remove(context, id));
});
