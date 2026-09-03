import { z } from "zod";

import { authRoute, ok, param } from "@/server/api/handler";
import { userService } from "@/server/services/users";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().email().optional(),
  username: z.string().trim().min(3).optional(),
  jobTitle: z.string().nullish(),
  badgeNumber: z.string().nullish(),
  phone: z.string().nullish(),
  departmentId: z.string().nullish(),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED", "DEACTIVATED"]).optional(),
  roleIds: z.array(z.string()).optional(),
});

export const GET = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await userService.get(context, id));
});

export const PATCH = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = updateSchema.parse(await request.json().catch(() => ({})));
  return ok(await userService.update(context, id, body));
});

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await userService.remove(context, id));
});
