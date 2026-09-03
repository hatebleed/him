import { AppError } from "@/lib/errors";
import { authRoute, ok } from "@/server/api/handler";
import { relationshipService } from "@/server/services/records";
import { relationshipSchema } from "@/lib/validation/records";

type Segment = { type: string; id: string };

export const GET = authRoute<Segment>(async (_request, context) => {
  const { type, id } = await context.segment.params;
  return ok({ rows: await relationshipService.list(context, type, id) });
});

export const POST = authRoute<Segment>(async (request, context) => {
  const body = relationshipSchema.parse(await request.json().catch(() => ({})));
  return ok(await relationshipService.link(context, body), undefined, 201);
});

export const DELETE = authRoute<Segment>(async (request, context) => {
  const relationshipId = new URL(request.url).searchParams.get("relationshipId");
  if (!relationshipId) throw AppError.badRequest("A relationshipId query parameter is required.");
  return ok(await relationshipService.unlink(context, relationshipId));
});
