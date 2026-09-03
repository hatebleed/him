import { z } from "zod";

/**
 * Form builder validation.
 *
 * Kept free of server-only imports so the same schema validates form input in
 * the browser and on the server.
 */
export const formFieldInputSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.string().default("TEXT"),
  section: z.string().nullish(),
  helpText: z.string().nullish(),
  placeholder: z.string().nullish(),
  required: z.boolean().default(false),
  defaultValue: z.string().nullish(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).nullish(),
  validation: z
    .object({ min: z.number().optional(), max: z.number().optional(), pattern: z.string().optional(), message: z.string().optional() })
    .nullish(),
  conditions: z.array(z.object({ field: z.string(), operator: z.string(), value: z.string() })).nullish(),
  width: z.string().default("full"),
  sortOrder: z.number().optional(),
});

export const formInputSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  description: z.string().nullish(),
  resourceType: z.string().min(1),
  fields: z.array(formFieldInputSchema).default([]),
});

export const formUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullish(),
  resourceType: z.string().optional(),
  status: z.string().optional(),
  fields: z.array(formFieldInputSchema).optional(),
});

export type FormFieldInput = z.input<typeof formFieldInputSchema>;
