import { authRoute, ok } from "@/server/api/handler";
import { communicationService } from "@/server/services/communications";
import { channelUpsertSchema } from "@/lib/validation/records";

export const GET = authRoute(async (_request, context) => ok({ rows: await communicationService.listChannels(context) }));

export const POST = authRoute(async (request, context) => {
  const body = channelUpsertSchema.parse(await request.json().catch(() => ({})));
  return ok(await communicationService.createChannel(context, body), undefined, 201);
});
