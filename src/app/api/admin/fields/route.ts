import { authRoute, ok } from "@/server/api/handler";
import { adminConfigService, customFieldInputSchema } from "@/server/services/admin-config";

const createSchema = customFieldInputSchema;

export const GET = authRoute(async (request, context) => {
  const resourceType = new URL(request.url).searchParams.get("resourceType") ?? undefined;
  return ok({ rows: await adminConfigService.listCustomFields(context, resourceType) });
});

export const POST = authRoute(async (request, context) => {
  const body = createSchema.parse(await request.json().catch(() => ({})));
  return ok(await adminConfigService.createCustomField(context, body), undefined, 201);
});
