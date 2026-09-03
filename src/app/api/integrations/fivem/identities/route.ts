import { z } from "zod";

import { authRoute, created, jsonBody, ok } from "@/server/api/handler";
import { parseBody } from "@/lib/validation/common";
import { fivemIntegration } from "@/server/integrations/fivem";

const linkSchema = z.object({
  citizenId: z.string().trim().min(1).max(64),
  userId: z.string().min(1),
  displayName: z.string().trim().max(120).nullish(),
});

/** GET /api/integrations/fivem/identities - characters linked to accounts. */
export const GET = authRoute(async (_request, context) => ok(await fivemIntegration.listIdentities(context)));

/** POST /api/integrations/fivem/identities - link a character to an account. */
export const POST = authRoute(async (request, context) => {
  const body = parseBody(linkSchema, await jsonBody(request));
  return created(await fivemIntegration.linkIdentity(context, body));
});
