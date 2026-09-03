"use client";

/** Standard API envelopes. */
export type ApiResponse<T> = { data: T; meta?: Record<string, unknown> };
export type ApiErrorBody = {
  error: { code: string; message: string; requestId?: string; details?: unknown };
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(body: ApiErrorBody["error"], status: number) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.status = status;
    this.requestId = body.requestId;
    this.details = body.details;
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/** Builds a query string, dropping empty values. */
export function toQueryString(params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * True when the application is rendered inside a frame belonging to another
 * site (a portal, a hosted preview). Reading `window.top` throws in that case,
 * which is itself the answer.
 *
 * The server cannot tell an embedded page from a top-level one, because a fetch
 * issued from inside the frame is same-origin. It uses this signal to issue a
 * partitioned (CHIPS) session cookie - the one kind of cookie browsers still
 * accept in a third-party context.
 */
function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Access token presented to the API.
 *
 * The in-game UI authenticates with a short-lived integration token instead of
 * a session cookie (the game's browser has no usable cookie jar for this site).
 * The web application never sets it, so both front-ends share one client.
 */
let apiToken: string | null = null;

export function setApiToken(token: string | null): void {
  apiToken = token && token.trim() ? token.trim() : null;
}

export function getApiToken(): string | null {
  return apiToken;
}

/**
 * Single client-side entry point for API calls.
 * Every response is unwrapped from the `{ data }` envelope and every failure
 * is surfaced as a typed `ApiError` carrying the server's request id.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${path}${options.method === "GET" || !options.method ? "" : ""}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(isEmbedded() ? { "x-embedded": "1" } : {}),
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      ...options.headers,
    },
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
    signal: options.signal,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    const body = isJson ? ((await response.json()) as ApiErrorBody) : null;
    throw new ApiError(
      body?.error ?? { code: "UNKNOWN", message: response.status === 401 ? "Your session has expired." : `Request failed (${response.status}).` },
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = isJson ? ((await response.json()) as ApiResponse<T> | T) : undefined;
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
}

/** Multipart upload (attachments, imports). */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(path, { method: "POST", body: formData, credentials: "same-origin" });
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  if (!response.ok) {
    const body = isJson ? ((await response.json()) as ApiErrorBody) : null;
    throw new ApiError(body?.error ?? { code: "UPLOAD_FAILED", message: "The upload failed." }, response.status);
  }
  const payload = isJson ? ((await response.json()) as ApiResponse<T>) : undefined;
  return (payload as ApiResponse<T>).data;
}

/** Downloads a server-generated CSV export for the user. */
export async function fetchCsv(resourceType: string, search = ""): Promise<void> {
  const response = await fetch(`/api/export?resourceType=${encodeURIComponent(resourceType)}&search=${encodeURIComponent(search)}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(body?.error ?? { code: "EXPORT_FAILED", message: "The export could not be generated." }, response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${resourceType}-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  fetchCsv,
  get: <T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal) =>
    apiFetch<T>(`${path}${toQueryString(params)}`, { method: "GET", signal }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  upload: apiUpload,
};

/** Extracts a readable message from any thrown value (used by toasts). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
