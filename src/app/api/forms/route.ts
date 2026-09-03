import { authRoute, ok } from "@/server/api/handler";
import { formInputSchema, formService } from "@/server/services/forms";

export const GET = authRoute(async (_request, context) => ok({ rows: await formService.list(context) }));

export const POST = authRoute(async (request, context) => {
  const body = formInputSchema.parse(await request.json().catch(() => ({})));
  return ok(await formService.create(context, body), undefined, 201);
});
