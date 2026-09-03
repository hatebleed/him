import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { getSessionUser, type AuthenticatedUser } from "@/lib/auth/session";
import { loadOperator, passwordAuthEnabled } from "@/lib/auth/operator";
import { AppError } from "@/lib/errors";
import { bearerToken, userForIntegrationToken } from "@/server/integrations/token-request";

import { loadUserPermissions } from "./permissions/service";

/**
 * The security context is ALWAYS derived on the server from the authenticated
 * session. Nothing about identity, roles or permissions is ever accepted from
 * the browser.
 */
export type RequestContext = {
  requestId: string;
  user: AuthenticatedUser;
  permissions: ReadonlySet<string>;
  roles: string[];
  ip: string | null;
  userAgent: string | null;
  path: string | null;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext {
  const context = storage.getStore();
  if (!context) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "No request context available. This code path requires an authenticated request.",
      status: 401,
    });
  }
  return context;
}

export function getOptionalContext(): RequestContext | null {
  return storage.getStore() ?? null;
}

export function runWithContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function clientIp(request?: NextRequest): string | null {
  if (!request) return null;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export function userAgent(request?: NextRequest): string | null {
  return request?.headers.get("user-agent") ?? null;
}

/**
 * The identity this request runs as.
 *
 * With `AUTH_MODE=none` there is no session to resolve: the request is
 * attributed to the configured operator account. Otherwise it comes from the
 * signed-in session cookie. Either way the result is a real user record.
 */
async function currentUser(request?: NextRequest): Promise<AuthenticatedUser | null> {
  // An integration token (an in-game operator) identifies the request on its
  // own: no cookie, and never a fall-through to the ambient session.
  const token = request ? bearerToken(request) : null;
  if (token) {
    const user = await userForIntegrationToken(token);
    if (!user) throw AppError.unauthenticated("That access token is invalid or has expired.");
    return user;
  }
  if (!passwordAuthEnabled()) return loadOperator();
  return getSessionUser();
}

/** Builds the security context for an identity. */
async function buildContext(user: AuthenticatedUser, request?: NextRequest): Promise<RequestContext> {
  const { permissions, roles } = await loadUserPermissions(user.id);
  return {
    requestId: request?.headers.get("x-request-id") ?? randomUUID(),
    user,
    permissions,
    roles,
    ip: clientIp(request),
    userAgent: userAgent(request),
    path: request?.nextUrl.pathname ?? null,
  };
}

/** Resolves the security context for the current request. */
export async function resolveContext(request?: NextRequest): Promise<RequestContext> {
  const user = await currentUser(request);
  if (!user) throw AppError.unauthenticated();
  return buildContext(user, request);
}

export async function resolveOptionalContext(request?: NextRequest): Promise<RequestContext | null> {
  const user = await currentUser(request);
  if (!user) return null;
  return buildContext(user, request);
}

/**
 * Authorisation guard used by every service and route.
 * Throws 401 when unauthenticated and 403 when the permission is missing.
 */
export function assertCan(context: RequestContext, permission: string): void {
  if (!context.permissions.has(permission)) {
    throw AppError.forbidden(`This action requires the "${permission}" permission.`);
  }
}

export function assertAnyCan(context: RequestContext, permissions: string[]): void {
  if (!permissions.some((permission) => context.permissions.has(permission))) {
    throw AppError.forbidden(`This action requires one of: ${permissions.join(", ")}.`);
  }
}

/**
 * UI-facing visibility check (never a substitute for a server-side guard).
 * A null permission means "no permission required".
 */
export function can(context: RequestContext | null, permission: string | undefined | null): boolean {
  if (!permission) return true;
  if (!context) return false;
  return context.permissions.has(permission);
}
