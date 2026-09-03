import { z } from "zod";

import { optionalDate, optionalNumber, optionalString } from "./common";

export const incidentUpsertSchema = z.object({
  title: z.string().trim().min(3, "Enter a descriptive title.").max(200),
  description: optionalString,
  status: z.string().trim().min(1).max(40).default("NEW"),
  priority: z.string().trim().min(1).max(40).default("MEDIUM"),
  categoryId: optionalString,
  departmentId: optionalString,
  location: optionalString,
  latitude: optionalNumber,
  longitude: optionalNumber,
  occurredAt: optionalDate,
  reportedAt: optionalDate,
  supervisorId: optionalString,
  customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])).optional(),
});

export type IncidentUpsertInput = z.infer<typeof incidentUpsertSchema>;

export const incidentStatusSchema = z.object({
  status: z.string().trim().min(1, "Select a status."),
  note: optionalString,
});

export const incidentLinkPersonSchema = z.object({
  personId: z.string().min(1, "Select a person."),
  role: z.string().trim().min(1).max(40).default("INVOLVED"),
  notes: optionalString,
});

export const incidentLinkVehicleSchema = z.object({
  vehicleId: z.string().min(1, "Select a vehicle."),
  role: z.string().trim().min(1).max(40).default("INVOLVED"),
  notes: optionalString,
});

export const assignUnitSchema = z.object({
  unitId: optionalString,
  userId: optionalString,
  role: z.string().trim().min(1).max(40).default("ASSIGNED"),
  notes: optionalString,
});

export const caseUpsertSchema = z.object({
  title: z.string().trim().min(3, "Enter a case title.").max(200),
  description: optionalString,
  status: z.string().trim().min(1).max(40).default("OPEN"),
  priority: z.string().trim().min(1).max(40).default("MEDIUM"),
  categoryId: optionalString,
  departmentId: optionalString,
  leadId: optionalString,
  openedAt: optionalDate,
  incidentIds: z.array(z.string()).max(50).default([]),
  customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])).optional(),
});

export const caseReviewSchema = z.object({
  status: z.string().trim().min(1),
  reviewNotes: optionalString,
});

export const callUpsertSchema = z.object({
  type: z.string().trim().min(1).max(40).default("GENERAL"),
  priority: z.string().trim().min(1).max(40).default("MEDIUM"),
  status: z.string().trim().min(1).max(40).default("PENDING"),
  description: optionalString,
  location: optionalString,
  callerName: optionalString,
  callerPhone: optionalString,
  departmentId: optionalString,
  incidentId: optionalString,
});

export const callUnitSchema = z.object({
  unitId: z.string().min(1, "Select a unit."),
  status: z.string().trim().min(1).max(40).default("ASSIGNED"),
});

export const unitUpsertSchema = z.object({
  name: z.string().trim().min(2, "Enter a unit name.").max(80),
  callsign: z.string().trim().min(1, "Enter a callsign.").max(24),
  departmentId: optionalString,
  status: z.string().trim().min(1).max(40).default("AVAILABLE"),
  location: optionalString,
  vehicleId: optionalString,
  notes: optionalString,
  memberIds: z.array(z.string()).max(20).default([]),
});

export const unitStatusSchema = z.object({
  status: z.string().trim().min(1, "Select a status."),
  note: optionalString,
  location: optionalString,
});

export type CaseUpsertInput = z.infer<typeof caseUpsertSchema>;
export type CallUpsertInput = z.infer<typeof callUpsertSchema>;
export type UnitUpsertInput = z.infer<typeof unitUpsertSchema>;
