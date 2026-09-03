import { authRoute, ok } from "@/server/api/handler";
import { attachmentService } from "@/server/services/records";
import { AppError } from "@/lib/errors";

type Segment = { type: string; id: string };

export const GET = authRoute<Segment>(async (_request, context) => {
  const { type, id } = await context.segment.params;
  return ok({ rows: await attachmentService.list(context, type, id) });
});

/**
 * POST /api/records/:type/:id/attachments
 * Multipart upload. MIME type, extension and magic bytes are all validated
 * server-side before the file is written to the configured storage provider.
 */
export const POST = authRoute<Segment>(async (request, context) => {
  const { type, id } = await context.segment.params;
  const form = await request.formData().catch(() => null);
  if (!form) throw AppError.badRequest("Expected multipart/form-data.");
  const file = form.get("file");
  if (!(file instanceof File)) throw AppError.badRequest("No file was provided.");
  const description = (form.get("description") as string | null) ?? null;
  const buffer = Buffer.from(await file.arrayBuffer());
  return ok(
    await attachmentService.upload(context, type, id, { name: file.name, type: file.type, size: file.size, data: buffer }, description),
    undefined,
    201,
  );
});
