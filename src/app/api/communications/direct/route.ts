import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { communicationService } from "@/server/services/communications";

/** POST /api/communications/direct - opens (or reuses) a DM channel. */
export const POST = authRoute(async (request, context) => {
  const body = z.object({ userId: z.string().min(1) }).parse(await request.json().catch(() => ({})));
  return ok(await communicationService.directChannel(context, body.userId));
});

export const GET = authRoute(async (_request, context) => ok({ rows: await communicationService.directory(context) }));
