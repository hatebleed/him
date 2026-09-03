import { jsonBody, ok, route } from "@/server/api/handler";
import { parseBody } from "@/lib/validation/common";
import { fivemIntegration, handshakeSchema } from "@/server/integrations/fivem";
import { assertIntegrationSecret } from "@/server/integrations/token-request";

/**
 * POST /api/integrations/fivem/handshake
 *
 * The game server exchanges a character for a short-lived access token. It is
 * authenticated with the shared secret (never sent to a player's machine); the
 * token it returns is what the in-game UI then presents as a bearer credential.
 */
export const POST = route(async (request) => {
  assertIntegrationSecret(request);
  const body = parseBody(handshakeSchema, await jsonBody(request));
  return ok(await fivemIntegration.handshake(body));
});
