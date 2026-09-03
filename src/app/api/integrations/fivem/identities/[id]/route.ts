import { authRoute, noContent, param } from "@/server/api/handler";
import { fivemIntegration } from "@/server/integrations/fivem";

/** DELETE /api/integrations/fivem/identities/:id - remove a character link. */
export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  await fivemIntegration.unlinkIdentity(context, await param(context.segment, "id"));
  return noContent();
});
