import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { noteService } from "@/server/services/records";

type Segment = { type: string; id: string };

export const GET = authRoute<Segment>(async (_request, context) => {
  const { type, id } = await context.segment.params;
  return ok({ rows: await noteService.list(context, type, id) });
});

export const POST = authRoute<Segment>(async (request, context) => {
  const { type, id } = await context.segment.params;
  const body = z.object({ body: z.string().trim().min(1).max(20_000), pinned: z.boolean().default(false) }).parse(await request.json().catch(() => ({})));
  return ok(await noteService.add(context, type, id, body.body, body.pinned), undefined, 201);
});

export const PATCH = authRoute<Segment>(async (request, context) => {
  await context.segment.params;
  const body = z.object({ id: z.string().min(1), body: z.string().trim().min(1).max(20_000), pinned: z.boolean().optional() }).parse(await request.json().catch(() => ({})));
  return ok(await noteService.update(context, body.id, body.body, body.pinned));
});

export const DELETE = authRoute<Segment>(async (request, context) => {
  await context.segment.params;
  const noteId = new URL(request.url).searchParams.get("noteId");
  if (!noteId) throw new Error("A noteId query parameter is required.");
  return ok(await noteService.remove(context, noteId));
});

