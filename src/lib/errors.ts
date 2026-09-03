import { NextResponse } from "next/server";

export const ERROR_CODES = {
  VALIDATION: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  LOCKED: "ACCOUNT_LOCKED",
  INTERNAL: "INTERNAL_ERROR",
  UNSUPPORTED: "UNSUPPORTED_OPERATION",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Application errors carry an explicit HTTP status and a stable machine
 * readable code. Stack traces never leave the server (see `toApiError`).
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(options: { code?: string; message: string; status?: number; details?: unknown; expose?: boolean; cause?: unknown }) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code ?? ERROR_CODES.INTERNAL;
    this.status = options.status ?? 500;
    this.details = options.details;
    this.expose = options.expose ?? this.status < 500;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError({ code: ERROR_CODES.VALIDATION, message, status: 400, details });
  }

  static unauthenticated(message = "You must be signed in to perform this action.") {
    return new AppError({ code: ERROR_CODES.UNAUTHENTICATED, message, status: 401 });
  }

  static forbidden(message = "You do not have permission to perform this action.") {
    return new AppError({ code: ERROR_CODES.FORBIDDEN, message, status: 403 });
  }

  static notFound(message = "The requested record was not found.") {
    return new AppError({ code: ERROR_CODES.NOT_FOUND, message, status: 404 });
  }

  static conflict(message: string, details?: unknown) {
    return new AppError({ code: ERROR_CODES.CONFLICT, message, status: 409, details });
  }

  static unsupported(message: string) {
    return new AppError({ code: ERROR_CODES.UNSUPPORTED, message, status: 400 });
  }

  static locked(message = "This account is temporarily locked after too many failed sign-in attempts.") {
    return new AppError({ code: ERROR_CODES.LOCKED, message, status: 423 });
  }
}

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = { data: T; meta?: Record<string, unknown> } | ApiErrorBody;

/** Wraps a successful payload in the standard envelope. */
export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json(meta ? { data, meta } : { data }, { status });
}

export function created<T>(data: T) {
  return ok(data, undefined, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Converts any thrown value into a safe API response.
 * Technical detail is logged server-side; the client only receives the code,
 * a human readable message and a request id for correlation.
 */
export function toApiError(error: unknown, requestId: string): { body: ApiErrorBody; status: number } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details ? { details: error.details } : {}),
        },
      },
    };
  }

  // Structured errors raised outside this module (e.g. schema validation in
  // shared client/server code) are honoured when they carry a code + status.
  const candidate = error as { code?: unknown; status?: unknown; details?: unknown; message?: unknown };
  if (typeof candidate?.code === "string" && typeof candidate?.status === "number" && candidate.status >= 400 && candidate.status < 600) {
    return {
      status: candidate.status,
      body: {
        error: {
          code: candidate.code,
          message: typeof candidate.message === "string" ? candidate.message : "The request could not be completed.",
          requestId,
          ...(candidate.details ? { details: candidate.details } : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: ERROR_CODES.INTERNAL,
        message: "An unexpected error occurred. The incident has been logged.",
        requestId,
      },
    },
  };
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Assigns (or forwards) a correlation id for the current request. */
export function requestIdFrom(headers: Headers): string {
  return headers.get("x-request-id") ?? crypto.randomUUID();
}
