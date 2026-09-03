import { authRoute, ok } from "@/server/api/handler";
import { opsWallService } from "@/server/services/ops-wall";

/** GET /api/ops-wall - everything the live operations console renders. */
export const GET = authRoute(async (_request, context) => ok(await opsWallService.snapshot(context)));
