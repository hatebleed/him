import { z } from "zod";

import { optionalDate, optionalString } from "./common";

export const customFieldsSchema = z
  .record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]))
  .default({});

export const identifierSchema = z.object({
  id: z.string().optional(),
  type: z.string().trim().min(1).max(40).default("NATIONAL_ID"),
  value: z.string().trim().min(1, "A value is required.").max(120),
  issuingAuthority: optionalString,
  notes: optionalString,
});

export const contactSchema = z.object({
  id: z.string().optional(),
  type: z.string().trim().min(1).max(40).default("EMAIL"),
  value: z.string().trim().min(1, "A value is required.").max(160),
  label: optionalString,
  isPrimary: z.boolean().default(false),
});

export const addressSchema = z.object({
  id: z.string().optional(),
  type: z.string().trim().min(1).max(40).default("HOME"),
  line1: z.string().trim().min(1, "Address line 1 is required.").max(160),
  line2: optionalString,
  city: optionalString,
  region: optionalString,
  postalCode: optionalString,
  country: optionalString,
  isPrimary: z.boolean().default(false),
  fromDate: optionalDate,
  toDate: optionalDate,
  notes: optionalString,
});

export const personUpsertSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  middleName: optionalString,
  alias: optionalString,
  dateOfBirth: optionalDate,
  gender: optionalString,
  nationality: optionalString,
  occupation: optionalString,
  status: z.string().trim().min(1).max(40).default("ACTIVE"),
  riskLevel: optionalString,
  categoryId: optionalString,
  departmentId: optionalString,
  notes: optionalString,
  identifiers: z.array(identifierSchema).max(40).default([]),
  contacts: z.array(contactSchema).max(40).default([]),
  addresses: z.array(addressSchema).max(40).default([]),
  customFields: customFieldsSchema.optional(),
});

export type PersonUpsertInput = z.infer<typeof personUpsertSchema>;

export const personLinkVehicleSchema = z.object({
  vehicleId: z.string().min(1, "Select a vehicle."),
  relationship: z.string().trim().min(1).max(40).default("OWNER"),
  isPrimary: z.boolean().default(false),
  startDate: optionalDate,
  endDate: optionalDate,
  notes: optionalString,
});

export const vehicleUpsertSchema = z.object({
  registration: z.string().trim().min(1, "Registration is required.").max(32),
  make: optionalString,
  model: optionalString,
  year: z.coerce.number().int().min(1886).max(2200).nullable().optional(),
  colour: optionalString,
  bodyType: optionalString,
  fuelType: optionalString,
  vin: optionalString,
  engineSize: optionalString,
  status: z.string().trim().min(1).max(40).default("ACTIVE"),
  categoryId: optionalString,
  departmentId: optionalString,
  notes: optionalString,
  customFields: customFieldsSchema.optional(),
});

export type VehicleUpsertInput = z.infer<typeof vehicleUpsertSchema>;
