import { runWithContext, type RequestContext } from "@/server/context";

/**
 * Runs a test body inside the request context so that services which derive
 * the actor from the ambient context (audit, timeline, notifications) behave
 * exactly as they do during a request.
 */
export function runInContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
  return runWithContext(context, fn);
}
