import { env } from "./env";

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** Fields whose values must never be written to logs. */
const REDACTED = new Set([
  "password",
  "passwordHash",
  "newPassword",
  "currentPassword",
  "token",
  "tokenHash",
  "sessionToken",
  "mfaSecret",
  "authorization",
  "cookie",
  "secret",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    result[key] = REDACTED.has(key) ? "[redacted]" : redact(raw, depth + 1);
  }
  return result;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[env.LOG_LEVEL]) return;
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  };
  const line = env.LOG_JSON ? JSON.stringify(entry) : `${entry.time} ${level.toUpperCase()} ${message}${context ? ` ${JSON.stringify(redact(context))}` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
