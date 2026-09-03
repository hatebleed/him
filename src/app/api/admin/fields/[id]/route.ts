import { authRoute, ok, param } from "@/server/api/handler";
import { adminConfigService, customFieldUpdateSchema } from "@/server/services/admin-config";

const updateSchema = customFieldUpdateSchema;

export const PATCH = authRoute<{ id: string }>(async (request, context) => {
  const id = await param(context.segment, "id" as never);
  const body = updateSchema.parse(await request.json().catch(() => ({})));
  return ok(await adminConfigService.updateCustomField(context, id, body));
});

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await adminConfigService.deleteCustomField(context, id));
});
