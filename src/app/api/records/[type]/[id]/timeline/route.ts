import { authRoute, ok } from "@/server/api/handler";
import { timelineService } from "@/server/services/records";

type Segment = { type: string; id: string };

export const GET = authRoute<Segment>(async (_request, context) => {
  const { type, id } = await context.segment.params;
  return ok({ rows: await timelineService.list(context, type, id) });
});
