import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { adminConfigService } from "@/server/services/admin-config";

const createSchema = z.object({
  resourceType: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  colour: z.string().default("#64748b"),
  icon: z.string().nullish(),
  description: z.string().nullish(),
  isDefault: z.boolean().default(false),
  isClosed: z.boolean().default(false),
  sortOrder: z.number().default(100),
});

export const GET = authRoute(async (request, context) => {
  const resourceType = new URL(request.url).searchParams.get("resourceType") ?? undefined;
  return ok({ rows: await adminConfigService.listStatuses(context, resourceType) });
});

export const POST = authRoute(async (request, context) => {
  const body = createSchema.parse(await request.json().catch(() => ({})));
  return ok(await adminConfigService.createStatus(context, body), undefined, 201);
});
