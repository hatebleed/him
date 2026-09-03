import { NextResponse } from "next/server";

import { authRoute, ok, param } from "@/server/api/handler";
import { attachmentService } from "@/server/services/records";

/** GET /api/attachments/:id - streams the file only if the user may read the record. */
export const GET = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  const { attachment, data } = await attachmentService.download(context, id);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
      "Content-Length": String(data.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = authRoute<{ id: string }>(async (_request, context) => {
  const id = await param(context.segment, "id" as never);
  return ok(await attachmentService.remove(context, id));
});
