import { z } from "zod";

import { authRoute, ok } from "@/server/api/handler";
import { searchAuditLogs } from "@/server/audit/audit";
import { recordAudit } from "@/server/audit/audit";

/**
 * GET /api/admin/audit
 * Requires `admin.audit.view`; every search is itself audited so the audit
 * trail cannot be browsed invisibly.
 */
export const GET = authRoute(async (request, _context) => {
  const url = new URL(request.url);
  const parsed = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(25),
      search: z.string().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
      actorId: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .parse(Object.fromEntries(url.searchParams));

  const result = await searchAuditLogs({
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search,
    action: parsed.action,
    resourceType: parsed.resourceType,
    actorId: parsed.actorId,
    from: parsed.from ? new Date(parsed.from) : undefined,
    to: parsed.to ? new Date(parsed.to) : undefined,
  });

  if (parsed.search || parsed.action || parsed.resourceType) {
    await recordAudit({
      action: "audit.searched",
      resourceType: "audit",
      summary: "Searched the audit trail",
      metadata: { search: parsed.search, action: parsed.action, resourceType: parsed.resourceType },
    });
  }

  return ok(result);
});
