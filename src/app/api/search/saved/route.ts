import { authRoute, ok } from "@/server/api/handler";
import { searchService } from "@/server/search/service";

export const GET = authRoute(async (_request, context) => ok({ rows: await searchService.recent(context) }));
