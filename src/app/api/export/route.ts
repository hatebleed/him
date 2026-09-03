import { NextResponse } from "next/server";
import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { exportService } from "@/server/services/import-export";

/** GET /api/export?resourceType=incident&search=... - permission-filtered CSV. */
export const GET = authRoute(async (request, context) => {
  const url = new URL(request.url);
  const parsed = z.object({ resourceType: z.string().min(1), search: z.string().default("") }).parse(Object.fromEntries(url.searchParams));
  const { fileName, csv } = await exportService.toCsv(context, parsed.resourceType, parsed.search);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
});

export const OPTIONS = authRoute(async () => ok({ rows: exportService.supportedTypes() }));
