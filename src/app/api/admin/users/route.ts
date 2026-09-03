import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { userService } from "@/server/services/users";
import { parseListParams } from "@/server/services/pagination";

const createSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  username: z.string().trim().min(3),
  password: z.string().optional(),
  jobTitle: z.string().nullish(),
  badgeNumber: z.string().nullish(),
  phone: z.string().nullish(),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED", "DEACTIVATED"]).default("ACTIVE"),
  departmentId: z.string().nullish(),
  roleIds: z.array(z.string()).default([]),
});

export const GET = authRoute(async (request, context) => {
  const params = parseListParams(new URL(request.url).searchParams);
  return ok(await userService.list(context, params));
});

export const POST = authRoute(async (request, context) => {
  const body = createSchema.parse(await request.json().catch(() => ({})));
  return ok(await userService.create(context, body), undefined, 201);
});
