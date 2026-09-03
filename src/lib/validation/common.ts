import { z } from "zod";

/** Shared validation primitives used by API routes and forms. */

export const idSchema = z.string().min(1, "An identifier is required.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().trim().max(200).optional().default(""),
  sort: z.string().max(80).optional(),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const dateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .partial();

export const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const optionalString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

export const optionalNumber = z
  .union([z.coerce.number(), z.null()])
  .optional()
  .transform((value) => (value === null || value === undefined || Number.isNaN(value) ? null : Number(value)));

export const referenceSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, "References may contain letters, numbers and dashes only.");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters.")
  .max(40)
  .regex(/^[a-z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores only.");

export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+()\d\s-]*$/, "Phone numbers may contain digits, spaces and + ( ) - only.")
  .optional()
  .or(z.literal(""));

/**
 * Validation error that carries field issues.
 *
 * Kept free of server-only imports (node:crypto in the error module) so the
 * same schemas can validate on the client without pulling server code in.
 */
export class QueryValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  readonly status = 400;
  readonly details: Record<string, string[] | undefined>;

  constructor(details: Record<string, string[] | undefined>) {
    super("Invalid query parameters.");
    this.name = "QueryValidationError";
    this.details = details;
  }
}

/** Parses a URL search string with a schema, throwing a structured 400. */
export function parseQuery<T extends z.ZodTypeAny>(schema: T, params: URLSearchParams): z.infer<T> {
  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) raw[key] = value;
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new QueryValidationError(result.error.flatten().fieldErrors);
  }
  return result.data;
}

export const customFieldValueSchema = z.record(z.unknown());
