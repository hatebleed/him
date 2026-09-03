import { z } from "zod";

/**
 * Environment variables are validated once at start-up so that a missing or
 * malformed value fails fast instead of producing a runtime surprise.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_COOKIE_NAME: z.string().default("him_session"),
  /**
   * "auto" detects the scheme per request (x-forwarded-proto, Forwarded,
   * Origin, Referer). Set "true" behind a proxy that hides it, "false" only
   * when the site is genuinely served over plain HTTP.
   */
  COOKIE_SECURE: z.enum(["auto", "true", "false"]).default("auto"),
  /**
   * "auto" uses SameSite=None when the cookie is Secure (so the app works when
   * embedded in a frame on another site) and SameSite=Lax otherwise.
   */
  COOKIE_SAMESITE: z.enum(["auto", "lax", "strict", "none"]).default("auto"),
  /** Extra origins allowed to call the API (comma separated), e.g. an intranet portal. */
  TRUSTED_ORIGINS: z.string().default(""),
  /** Reject state-changing requests that browsers report as cross-site. */
  CSRF_PROTECTION: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  /**
   * "none"      - no sign-in at all: every request runs as OPERATOR_USER with
   *               that account's real roles and permissions (demos, previews,
   *               single-operator installs, embedded displays).
   * "password"  - accounts sign in with a username/email and password.
   */
  AUTH_MODE: z.enum(["none", "password"]).default("password"),
  /** The account every request runs as when AUTH_MODE=none (username or email). */
  OPERATOR_USER: z.string().default("admin"),
  MAX_FAILED_LOGINS: z.coerce.number().int().positive().default(8),
  ACCOUNT_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  APP_URL: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_JSON: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  SEARCH_PROVIDER: z.enum(["postgres", "none"]).default("postgres"),
  REALTIME_PROVIDER: z.enum(["local", "none"]).default("local"),
  DISPATCH_PROVIDER: z.enum(["mock", "none"]).default("mock"),
  NOTIFICATION_PROVIDER: z.enum(["in-app", "none"]).default("in-app"),
  EMAIL_PROVIDER: z.enum(["console", "none"]).default("console"),
  MAPS_PROVIDER: z.enum(["none", "maplibre"]).default("none"),
  /**
   * FiveM integration.
   *
   * The in-game resource exchanges a citizen id for a short-lived access
   * token at `POST /api/integrations/fivem/handshake`. Requests are
   * authenticated with a shared secret; the token is what the game client
   * sends, so the secret never reaches a player's machine.
   */
  FIVEM_API_KEY: z.string().default(""),
  /** Lifetime of an in-game access token, in hours. */
  FIVEM_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(12),
  /**
   * Create (and link) a user the first time an unknown citizen id opens the
   * MDT. Off by default: identities are linked deliberately by an
   * administrator, because a provisioned account inherits its job's role.
   */
  FIVEM_AUTO_PROVISION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /**
   * Job -> role key mapping used when provisioning, as JSON, e.g.
   *   {"police":"officer","ambulance":"medic"}
   * An administrator can override it with the `fivem.jobRoles` setting.
   */
  FIVEM_JOB_ROLES: z.string().default("{}"),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SESSION_TTL_HOURS: process.env.SESSION_TTL_HOURS,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  COOKIE_SECURE: process.env.COOKIE_SECURE,
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE,
  TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS,
  CSRF_PROTECTION: process.env.CSRF_PROTECTION,
  AUTH_MODE: process.env.AUTH_MODE,
  OPERATOR_USER: process.env.OPERATOR_USER,
  MAX_FAILED_LOGINS: process.env.MAX_FAILED_LOGINS,
  ACCOUNT_LOCKOUT_MINUTES: process.env.ACCOUNT_LOCKOUT_MINUTES,
  APP_URL: process.env.APP_URL,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOG_JSON: process.env.LOG_JSON,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR,
  MAX_UPLOAD_MB: process.env.MAX_UPLOAD_MB,
  SEARCH_PROVIDER: process.env.SEARCH_PROVIDER,
  REALTIME_PROVIDER: process.env.REALTIME_PROVIDER,
  DISPATCH_PROVIDER: process.env.DISPATCH_PROVIDER,
  NOTIFICATION_PROVIDER: process.env.NOTIFICATION_PROVIDER,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  MAPS_PROVIDER: process.env.MAPS_PROVIDER,
  FIVEM_API_KEY: process.env.FIVEM_API_KEY,
  FIVEM_TOKEN_TTL_HOURS: process.env.FIVEM_TOKEN_TTL_HOURS,
  FIVEM_AUTO_PROVISION: process.env.FIVEM_AUTO_PROVISION,
  FIVEM_JOB_ROLES: process.env.FIVEM_JOB_ROLES,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}\nCopy .env.example to .env and adjust it.`);
}

export const env = parsed.data;
export type Env = typeof env;

/** `TRUSTED_ORIGINS` split into a usable list. */
export function trustedOrigins(): string[] {
  return env.TRUSTED_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
