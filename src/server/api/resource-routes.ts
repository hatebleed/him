import "server-only";

import { type ZodTypeAny } from "zod";

import { AppError } from "@/lib/errors";
import { assertCan } from "@/server/context";
import { parseListParams } from "@/server/services/pagination";

import { authRoute, jsonBody, ok, param, type RouteSegment } from "./handler";
import type { RequestContext } from "../context";

type ListFn<T> = (ctx: RequestContext, params: ReturnType<typeof parseListParams>) => Promise<T>;
type GetFn<T> = (ctx: RequestContext, id: string) => Promise<T>;
type MutateFn<T> = (ctx: RequestContext, id: string, input: unknown) => Promise<T>;
type CreateFn<T> = (ctx: RequestContext, input: unknown) => Promise<T>;
type RemoveFn = (ctx: RequestContext, id: string) => Promise<unknown>;

export type ResourceRoutes<TList, TDetail> = {
  list?: ListFn<TList>;
  get?: GetFn<TDetail>;
  create?: { schema: ZodTypeAny; permission: string; handler: CreateFn<unknown> };
  update?: { schema: ZodTypeAny; permission: string; handler: MutateFn<unknown> };
  remove?: { permission: string; handler: RemoveFn };
  viewPermission?: string;
};

/**
 * Collection route factory.
 *
 * Every resource exposes the same verbs with the same guarantees:
 * authentication, input validation, permission enforcement and a consistent
 * response envelope. Modules supply only their own business logic.
 */
export function collectionRoutes<TList, TDetail>(config: ResourceRoutes<TList, TDetail>) {
  return {
    GET: authRoute(async (request, context) => {
      if (!config.list) throw AppError.unsupported("Listing is not available for this resource.");
      const url = new URL(request.url);
      const params = parseListParams(url.searchParams);
      return ok(await config.list(context, params));
    }),

    POST: authRoute(async (request, context) => {
      if (!config.create) throw AppError.unsupported("Creating records is not available for this resource.");
      assertCan(context, config.create.permission);
      const body = config.create.schema.parse(await jsonBody(request));
      const created = await config.create.handler(context, body);
      return ok(created, undefined, 201);
    }),
  };
}

export function detailRoutes<TList, TDetail>(config: ResourceRoutes<TList, TDetail>) {
  return {
    GET: authRoute<{ id: string }>(async (_request, context) => {
      if (!config.get) throw AppError.unsupported("Reading this record is not available.");
      const id = await param<{ id: string }>(context.segment as RouteSegment<{ id: string }>, "id");
      return ok(await config.get(context, id));
    }),

    PATCH: authRoute<{ id: string }>(async (request, context) => {
      if (!config.update) throw AppError.unsupported("Updating this record is not available.");
      assertCan(context, config.update.permission);
      const id = await param<{ id: string }>(context.segment as RouteSegment<{ id: string }>, "id");
      const body = config.update.schema.parse(await jsonBody(request));
      return ok(await config.update.handler(context, id, body));
    }),

    DELETE: authRoute<{ id: string }>(async (_request, context) => {
      if (!config.remove) throw AppError.unsupported("Deleting this record is not available.");
      assertCan(context, config.remove.permission);
      const id = await param<{ id: string }>(context.segment as RouteSegment<{ id: string }>, "id");
      return ok(await config.remove.handler(context, id));
    }),
  };
}
