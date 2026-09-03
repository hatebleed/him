import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { AppError, requestIdFrom, toApiError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { resolveContext, resolveOptionalContext, runWithContext, type RequestContext } from "@/server/context";
import { assertSameOrigin } from "@/server/security/csrf";

export { created, noContent, ok } from "@/lib/errors";

export type RouteSegment<Params> = { params: Promise<Params> };

type PublicHandler<Params> = (request: NextRequest, segment: RouteSegment<Params>) => Promise<Response>;

/**
 * Public route wrapper: assigns a request id, catches every thrown error and
 * returns the standard error envelope (no stack traces in production).
 */
export function route<Params extends Record<string, string> = Record<string, never>>(
  handler: PublicHandler<Params>,
): PublicHandler<Params> {
  return async (request, segment) => {
    const requestId = requestIdFrom(request.headers);
    try {
      // State-changing requests must originate from this site (or a configured
      // trusted origin); see src/server/security/csrf.ts.
      if (env.CSRF_PROTECTION) assertSameOrigin(request);
      const response = await handler(request, segment);
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      const { body, status } = toApiError(error, requestId);
      // Expected failures (validation, auth, authorisation) are warnings;
      // unexpected ones keep the stack so they can be diagnosed.
      const level = status < 500 ? "warn" : "error";
      logger[level](status < 500 ? "Request rejected" : "Unhandled API error", {
        requestId,
        path: request.nextUrl.pathname,
        method: request.method,
        status,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, ...(status < 500 ? {} : { stack: error.stack }) }
            : error,
      });
      return NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
    }
  };
}

type AuthHandler<Params> = (
  request: NextRequest,
  context: RequestContext & { segment: RouteSegment<Params> },
) => Promise<Response>;

/**
 * Authenticated route wrapper: resolves the security context from the session
 * and runs the handler inside it so every nested service call can authorise
 * itself. Returns 401 when there is no valid session.
 */
export function authRoute<Params extends Record<string, string> = Record<string, never>>(
  handler: AuthHandler<Params>,
): PublicHandler<Params> {
  return route<Params>(async (request, segment) => {
    const context = await resolveContext(request);
    return runWithContext(context, () => handler(request, { ...context, segment }));
  });
}

/** Authenticated + permission-guarded route wrapper. */
export function guardedRoute<Params extends Record<string, string> = Record<string, never>>(
  permission: string,
  handler: AuthHandler<Params>,
): PublicHandler<Params> {
  return authRoute<Params>(async (request, context) => {
    if (!context.permissions.has(permission)) {
      throw AppError.forbidden(`This action requires the "${permission}" permission.`);
    }
    return handler(request, context);
  });
}

/** Optional-authentication route wrapper (context may be null). */
export function optionalAuthRoute<Params extends Record<string, string> = Record<string, never>>(
  handler: (request: NextRequest, context: (RequestContext & { segment: RouteSegment<Params> }) | null) => Promise<Response>,
): PublicHandler<Params> {
  return route<Params>(async (request, segment) => {
    const context = await resolveOptionalContext(request);
    if (!context) return handler(request, null);
    return runWithContext(context, () => handler(request, { ...context, segment }));
  });
}

/** Reads and validates a route parameter. */
export async function param<Params extends Record<string, string>>(segment: RouteSegment<Params>, key: keyof Params & string): Promise<string> {
  const params = await segment.params;
  const value = params[key];
  if (!value) throw AppError.badRequest(`Missing route parameter "${key}".`);
  return value;
}

/** Parses a JSON request body, throwing a structured 400 on malformed input. */
export async function jsonBody<T>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw AppError.badRequest("Request body must be valid JSON.");
  }
}
