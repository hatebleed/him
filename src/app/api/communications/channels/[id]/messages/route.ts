import { authRoute, ok, param } from "@/server/api/handler";
import { communicationService } from "@/server/services/communications";
import { messageSchema } from "@/lib/validation/records";

export const GET = authRoute<{ id: string }>(async (_request, context) => {
  const channelId = await param(context.segment, "id" as never);
  return ok(await communicationService.getChannel(context, channelId));
});

export const POST = authRoute<{ id: string }>(async (request, context) => {
  const channelId = await param(context.segment, "id" as never);
  const body = messageSchema.parse({ ...(await request.json().catch(() => ({}))), channelId });
  return ok(await communicationService.sendMessage(context, channelId, body.body), undefined, 201);
});
