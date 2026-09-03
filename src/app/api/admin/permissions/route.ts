import { authRoute, ok } from "@/server/api/handler";
import { roleService } from "@/server/services/roles";

export const GET = authRoute(async (_request, context) => ok(await roleService.permissionsCatalogue(context)));
