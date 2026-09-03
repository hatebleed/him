import { z } from "zod";

import { authRoute, ok, param } from "@/server/api/handler";
import { adminConfigService } from "@/server/services/admin-config";

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  colour: z.string().optional(),
  icon: z.string().nullish(),
  description: z.string().nullish(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const PATCH = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = updateSchema.parse(await request.json().catch(() => ({})));
  return ok(await adminConfigService.updateCategory(context, id, body));
});

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await adminConfigService.deleteCategory(context, id));
});
