import { z } from "zod";

import { optionalDate, optionalNumber, optionalString } from "./common";

const custom = z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]));

export const reportUpsertSchema = z.object({
  title: z.string().trim().min(3, "Enter a report title.").max(200),
  body: z.string().max(200_000).default(""),
  incidentId: optionalString,
  caseId: optionalString,
  categoryId: optionalString,
  status: z.string().trim().min(1).max(40).default("DRAFT"),
  formData: z.record(z.unknown()).optional(),
  customFields: custom.optional(),
});

export const reportTransitionSchema = z.object({
  action: z.enum(["SUBMIT", "REVIEW", "APPROVE", "REJECT", "FINALISE", "ARCHIVE", "REOPEN"]),
  reason: optionalString,
  changeNote: optionalString,
});

export const taskUpsertSchema = z.object({
  title: z.string().trim().min(3, "Enter a task title.").max(200),
  description: optionalString,
  status: z.string().trim().min(1).max(40).default("OPEN"),
  priority: z.string().trim().min(1).max(40).default("MEDIUM"),
  assigneeId: optionalString,
  departmentId: optionalString,
  dueAt: optionalDate,
  recordType: optionalString,
  recordId: optionalString,
  customFields: custom.optional(),
});

export const taskCommentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment.").max(5000),
});

export const warrantUpsertSchema = z.object({
  personId: z.string().min(1, "Select a person."),
  type: z.string().trim().min(1).max(40).default("ARREST"),
  status: z.string().trim().min(1).max(40).default("ACTIVE"),
  description: optionalString,
  issuingAuthority: optionalString,
  issuedAt: optionalDate,
  expiresAt: optionalDate,
  notes: optionalString,
});

export const alertUpsertSchema = z.object({
  type: z.string().trim().min(1).max(40).default("GENERAL"),
  subject: z.string().trim().min(2, "Enter a subject.").max(200),
  description: optionalString,
  priority: z.string().trim().min(1).max(40).default("MEDIUM"),
  status: z.string().trim().min(1).max(40).default("ACTIVE"),
  categoryId: optionalString,
  personId: optionalString,
  vehicleId: optionalString,
  incidentId: optionalString,
  expiresAt: optionalDate,
  notes: optionalString,
  notify: z.boolean().default(false),
});

export const boloUpsertSchema = z.object({
  subject: z.string().trim().min(2, "Enter a subject.").max(200),
  description: optionalString,
  status: z.string().trim().min(1).max(40).default("ACTIVE"),
  priority: z.string().trim().min(1).max(40).default("MEDIUM"),
  personId: optionalString,
  vehicleId: optionalString,
  incidentId: optionalString,
  expiresAt: optionalDate,
  notes: optionalString,
});

export const evidenceUpsertSchema = z.object({
  description: z.string().trim().min(2, "Describe the item.").max(500),
  categoryId: optionalString,
  quantity: z.coerce.number().int().min(1).max(10_000).default(1),
  unitLabel: optionalString,
  location: optionalString,
  status: z.string().trim().min(1).max(40).default("IN_CUSTODY"),
  incidentId: optionalString,
  custodianId: optionalString,
  collectedAt: optionalDate,
  collectedFrom: optionalString,
  notes: optionalString,
  customFields: custom.optional(),
});

export const evidenceTransferSchema = z.object({
  type: z.string().trim().min(1).max(40).default("TRANSFER"),
  toLocation: optionalString,
  toCustodianId: optionalString,
  notes: optionalString,
});

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Write a note.").max(20_000),
  pinned: z.boolean().default(false),
});

export const relationshipSchema = z.object({
  fromType: z.string().min(1),
  fromId: z.string().min(1),
  toType: z.string().min(1),
  toId: z.string().min(1),
  relationType: z.string().trim().min(1).max(40).default("RELATED"),
});

export const messageSchema = z.object({
  channelId: z.string().min(1),
  body: z.string().trim().min(1, "Write a message.").max(10_000),
});

export const channelUpsertSchema = z.object({
  name: z.string().trim().min(2, "Enter a channel name.").max(80),
  topic: optionalString,
  type: z.enum(["DIRECT", "GROUP", "DEPARTMENT", "UNIT", "INCIDENT"]).default("GROUP"),
  departmentId: optionalString,
  unitId: optionalString,
  memberIds: z.array(z.string()).max(100).default([]),
});

export const attachmentMetaSchema = z.object({
  recordType: z.string().min(1),
  recordId: z.string().min(1),
  description: optionalString,
});

export const importCommitSchema = z.object({
  resourceType: z.string().min(1),
  mapping: z.record(z.string()),
  rows: z.array(z.record(z.unknown())).min(1).max(5000),
  dryRun: z.boolean().default(false),
});

export { optionalNumber };

export type ReportUpsertInput = z.infer<typeof reportUpsertSchema>;
export type TaskUpsertInput = z.infer<typeof taskUpsertSchema>;
export type WarrantUpsertInput = z.infer<typeof warrantUpsertSchema>;
export type AlertUpsertInput = z.infer<typeof alertUpsertSchema>;
export type BoloUpsertInput = z.infer<typeof boloUpsertSchema>;
export type EvidenceUpsertInput = z.infer<typeof evidenceUpsertSchema>;
export type ChannelUpsertInput = z.infer<typeof channelUpsertSchema>;
export type ImportCommitInput = z.infer<typeof importCommitSchema>;
