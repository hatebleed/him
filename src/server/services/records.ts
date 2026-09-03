import "server-only";

import { and, desc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { attachments, notes, recordRelationships, timelineEntries, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { storage, validateUpload, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { recordAudit, recordTimeline } from "@/server/audit/audit";
import { assertCan, type RequestContext } from "@/server/context";

/**
 * Generic record infrastructure shared by every module: notes, attachments,
 * relationships and timelines. Access is derived from the record type, so a
 * user can only touch sub-records of records they are allowed to view.
 */
const VIEW_PERMISSION: Record<string, string> = {
  person: "people.view",
  vehicle: "vehicles.view",
  incident: "incidents.view",
  case: "cases.view",
  report: "reports.view",
  task: "tasks.view",
  warrant: "warrants.view",
  alert: "alerts.view",
  bolo: "bolos.view",
  evidence: "evidence.view",
  call: "calls.view",
  unit: "units.view",
};

const EDIT_PERMISSION: Record<string, string> = {
  person: "people.edit",
  vehicle: "vehicles.edit",
  incident: "incidents.edit",
  case: "cases.edit",
  report: "reports.edit",
  task: "tasks.edit",
  warrant: "warrants.edit",
  alert: "alerts.edit",
  bolo: "bolos.edit",
  evidence: "evidence.edit",
  call: "calls.edit",
  unit: "units.edit",
};

function assertRecordAccess(ctx: RequestContext, recordType: string, write = false): void {
  const permission = write ? EDIT_PERMISSION[recordType] : VIEW_PERMISSION[recordType];
  if (!permission) throw AppError.badRequest(`Unknown record type "${recordType}".`);
  assertCan(ctx, permission);
}

export const noteService = {
  async list(ctx: RequestContext, recordType: string, recordId: string) {
    assertRecordAccess(ctx, recordType);
    return db
      .select({
        id: notes.id,
        body: notes.body,
        pinned: notes.pinned,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        authorId: notes.authorId,
        authorName: users.name,
      })
      .from(notes)
      .leftJoin(users, eq(users.id, notes.authorId))
      .where(and(eq(notes.recordType, recordType), eq(notes.recordId, recordId)))
      .orderBy(desc(notes.pinned), desc(notes.createdAt));
  },

  async add(ctx: RequestContext, recordType: string, recordId: string, body: string, pinned = false) {
    assertRecordAccess(ctx, recordType, true);
    const [note] = await db.insert(notes).values({ recordType, recordId, body, pinned, authorId: ctx.user.id }).returning();
    await recordTimeline({ recordType, recordId, type: "NOTE", message: `${ctx.user.name} added a note` });
    return note;
  },

  async update(ctx: RequestContext, id: string, body: string, pinned?: boolean) {
    const [existing] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This note does not exist.");
    assertRecordAccess(ctx, existing.recordType, true);
    if (existing.authorId !== ctx.user.id && !ctx.permissions.has("admin.access")) {
      throw AppError.forbidden("You can only edit your own notes.");
    }
    const [updated] = await db.update(notes).set({ body, pinned: pinned ?? existing.pinned }).where(eq(notes.id, id)).returning();
    return updated;
  },

  async remove(ctx: RequestContext, id: string) {
    const [existing] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This note does not exist.");
    assertRecordAccess(ctx, existing.recordType, true);
    if (existing.authorId !== ctx.user.id && !ctx.permissions.has("admin.access")) {
      throw AppError.forbidden("You can only delete your own notes.");
    }
    await db.delete(notes).where(eq(notes.id, id));
    return { id };
  },
};

export const attachmentService = {
  async list(ctx: RequestContext, recordType: string, recordId: string) {
    assertRecordAccess(ctx, recordType);
    return db
      .select({
        id: attachments.id,
        fileName: attachments.fileName,
        mimeType: attachments.mimeType,
        size: attachments.size,
        description: attachments.description,
        createdAt: attachments.createdAt,
        uploadedById: attachments.uploadedById,
        uploadedByName: users.name,
      })
      .from(attachments)
      .leftJoin(users, eq(users.id, attachments.uploadedById))
      .where(and(eq(attachments.recordType, recordType), eq(attachments.recordId, recordId), isNull(attachments.deletedAt)))
      .orderBy(desc(attachments.createdAt));
  },

  async upload(ctx: RequestContext, recordType: string, recordId: string, file: { name: string; type: string; size: number; data: Buffer }, description?: string | null) {
    assertRecordAccess(ctx, recordType, true);
    if (file.size > MAX_UPLOAD_BYTES) {
      throw AppError.badRequest(`Files must be ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB or smaller.`);
    }
    // Content sniffing + extension allow-list: client MIME type alone is never trusted.
    const { mimeType } = validateUpload(file);

    const stored = await storage.put({ fileName: file.name, mimeType, data: file.data });
    const [attachment] = await db
      .insert(attachments)
      .values({
        fileName: file.name,
        storageKey: stored.key,
        mimeType: stored.mimeType,
        size: stored.size,
        checksum: stored.checksum,
        recordType,
        recordId,
        description: description ?? null,
        uploadedById: ctx.user.id,
      })
      .returning();

    await recordTimeline({ recordType, recordId, type: "ATTACHMENT", message: `${ctx.user.name} attached ${file.name}` });
    await recordAudit({
      action: "attachment.uploaded",
      resourceType: recordType,
      resourceId: recordId,
      summary: `Attached ${file.name}`,
      newValue: { attachmentId: attachment!.id, size: stored.size, mimeType: stored.mimeType },
    });
    return attachment;
  },

  async download(ctx: RequestContext, id: string) {
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    if (!attachment || attachment.deletedAt) throw AppError.notFound("This attachment does not exist.");
    assertRecordAccess(ctx, attachment.recordType);
    assertCan(ctx, "attachments.download");

    const file = await storage.get(attachment.storageKey);
    if (!file) throw AppError.notFound("The stored file is no longer available.");
    return { attachment, data: file.data };
  },

  async remove(ctx: RequestContext, id: string) {
    const [existing] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This attachment does not exist.");
    assertRecordAccess(ctx, existing.recordType, true);
    assertCan(ctx, "attachments.delete");

    await db.update(attachments).set({ deletedAt: new Date() }).where(eq(attachments.id, id));
    await storage.delete(existing.storageKey);
    await recordTimeline({ recordType: existing.recordType, recordId: existing.recordId, type: "ATTACHMENT", message: `${ctx.user.name} removed ${existing.fileName}` });
    await recordAudit({ action: "attachment.deleted", resourceType: existing.recordType, resourceId: existing.recordId, summary: `Removed attachment ${existing.fileName}` });
    return { id };
  },
};

export const relationshipService = {
  async list(ctx: RequestContext, recordType: string, recordId: string) {
    assertRecordAccess(ctx, recordType);
    const rows = await db
      .select()
      .from(recordRelationships)
      .where(
        or(
          and(eq(recordRelationships.fromType, recordType), eq(recordRelationships.fromId, recordId)),
          and(eq(recordRelationships.toType, recordType), eq(recordRelationships.toId, recordId)),
        ),
      )
      .orderBy(desc(recordRelationships.createdAt));
    return rows.filter((row) => VIEW_PERMISSION[row.fromType] && VIEW_PERMISSION[row.toType]);
  },

  async link(ctx: RequestContext, input: { fromType: string; fromId: string; toType: string; toId: string; relationType: string }) {
    assertRecordAccess(ctx, input.fromType, true);
    assertRecordAccess(ctx, input.toType, true);
    if (input.fromId === input.toId && input.fromType === input.toType) {
      throw AppError.badRequest("A record cannot be related to itself.");
    }

    await db.insert(recordRelationships).values(input).onConflictDoNothing();
    await recordTimeline({
      recordType: input.fromType,
      recordId: input.fromId,
      type: "RELATIONSHIP",
      message: `Linked to ${input.toType}`,
    });
    await recordTimeline({
      recordType: input.toType,
      recordId: input.toId,
      type: "RELATIONSHIP",
      message: `Linked from ${input.fromType}`,
    });
    await recordAudit({
      action: "relationship.created",
      resourceType: input.fromType,
      resourceId: input.fromId,
      summary: `Linked ${input.fromType} to ${input.toType}`,
      newValue: input,
    });
    return { ok: true };
  },

  async unlink(ctx: RequestContext, id: string) {
    const [existing] = await db.select().from(recordRelationships).where(eq(recordRelationships.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This relationship does not exist.");
    assertRecordAccess(ctx, existing.fromType, true);
    await db.delete(recordRelationships).where(eq(recordRelationships.id, id));
    await recordAudit({
      action: "relationship.deleted",
      resourceType: existing.fromType,
      resourceId: existing.fromId,
      summary: "Removed relationship",
      previousValue: existing,
    });
    return { ok: true };
  },
};

export const timelineService = {
  async list(ctx: RequestContext, recordType: string, recordId: string, limit = 100) {
    assertRecordAccess(ctx, recordType);
    return db
      .select({
        id: timelineEntries.id,
        type: timelineEntries.type,
        message: timelineEntries.message,
        actorName: timelineEntries.actorName,
        metadata: timelineEntries.metadata,
        occurredAt: timelineEntries.occurredAt,
      })
      .from(timelineEntries)
      .where(and(eq(timelineEntries.recordType, recordType), eq(timelineEntries.recordId, recordId)))
      .orderBy(desc(timelineEntries.occurredAt))
      .limit(limit);
  },
};
