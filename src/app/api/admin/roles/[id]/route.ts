import { z } from "zod";

import { authRoute, ok, param } from "@/server/api/handler";
import { roleService } from "@/server/services/roles";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().nullish(),
  permissionKeys: z.array(z.string()).optional(),
});

export const PATCH = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = updateSchema.parse(await request.json().catch(() => ({})));
  if (body.permissionKeys) {
    // Prevents accidentally locking every administrator out of role management.
    await roleService.assertNotRemovingLastAdminRole(id, body.permissionKeys);
  }
  return ok(await roleService.update(context, id, body));
});

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await roleService.remove(context, id));
});
