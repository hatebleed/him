import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { evidence, evidenceEvents, incidents, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { EvidenceUpsertInput } from "@/lib/validation/records";

import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { readCustomValues, readCustomValuesForRecord, writeCustomValues } from "./custom-fields";
import { combine, multi, orderByDirection, single, type ListParams } from "./pagination";
import { nextReference, REFERENCE_PREFIXES } from "./reference";

const sortColumns = {
  itemNumber: evidence.itemNumber,
  description: evidence.description,
  status: evidence.status,
  createdAt: evidence.createdAt,
} as const;

export const evidenceService = {
  async list(ctx: RequestContext, params: ListParams) {
    assertCan(ctx, "evidence.view");
    const conditions: SQL[] = [isNull(evidence.deletedAt)];
    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(ilike(evidence.itemNumber, term), ilike(evidence.description, term), ilike(evidence.location, term));
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(evidence.status, statuses));
    const incident = single(params.filters.incident);
    if (incident) conditions.push(eq(evidence.incidentId, incident));
    const custodian = single(params.filters.custodian);
    if (custodian) conditions.push(eq(evidence.custodianId, custodian));

    const where = combine(...conditions);
    const sortColumn = sortColumns[(params.sort ?? "createdAt") as keyof typeof sortColumns] ?? evidence.createdAt;

    const rows = await db
      .select({
        id: evidence.id,
        itemNumber: evidence.itemNumber,
        description: evidence.description,
        quantity: evidence.quantity,
        status: evidence.status,
        location: evidence.location,
        incidentId: evidence.incidentId,
        incidentReference: incidents.reference,
        custodianId: evidence.custodianId,
        custodianName: users.name,
        collectedAt: evidence.collectedAt,
        createdAt: evidence.createdAt,
      })
      .from(evidence)
      .leftJoin(incidents, eq(incidents.id, evidence.incidentId))
      .leftJoin(users, eq(users.id, evidence.custodianId))
      .where(where)
      .orderBy(orderByDirection(sortColumn, params.dir))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(evidence).where(where);
    const customValues = await readCustomValues("evidence", rows.map((row) => row.id));

    return {
      rows: rows.map((row) => ({ ...row, customFields: customValues.get(row.id) ?? {} })),
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "evidence.view");
    const [item] = await db
      .select({
        id: evidence.id,
        itemNumber: evidence.itemNumber,
        description: evidence.description,
        categoryId: evidence.categoryId,
        quantity: evidence.quantity,
        unitLabel: evidence.unitLabel,
        location: evidence.location,
        status: evidence.status,
        incidentId: evidence.incidentId,
        incidentReference: incidents.reference,
        custodianId: evidence.custodianId,
        custodianName: users.name,
        collectedAt: evidence.collectedAt,
        collectedFrom: evidence.collectedFrom,
        notes: evidence.notes,
        createdAt: evidence.createdAt,
        updatedAt: evidence.updatedAt,
      })
      .from(evidence)
      .leftJoin(incidents, eq(incidents.id, evidence.incidentId))
      .leftJoin(users, eq(users.id, evidence.custodianId))
      .where(and(eq(evidence.id, id), isNull(evidence.deletedAt)))
      .limit(1);

    if (!item) throw AppError.notFound("This evidence item does not exist.");

    const [events, customFields] = await Promise.all([
      db
        .select({
          id: evidenceEvents.id,
          type: evidenceEvents.type,
          fromLocation: evidenceEvents.fromLocation,
          toLocation: evidenceEvents.toLocation,
          toCustodianName: users.name,
          actorName: evidenceEvents.actorId,
          notes: evidenceEvents.notes,
          occurredAt: evidenceEvents.occurredAt,
        })
        .from(evidenceEvents)
        .leftJoin(users, eq(users.id, evidenceEvents.toCustodianId))
        .where(eq(evidenceEvents.evidenceId, id))
        .orderBy(desc(evidenceEvents.occurredAt)),
      readCustomValuesForRecord("evidence", id),
    ]);

    return { ...item, events, customFields };
  },

  async create(ctx: RequestContext, input: EvidenceUpsertInput) {
    assertCan(ctx, "evidence.create");
    const itemNumber = await nextReference(evidence, REFERENCE_PREFIXES.evidence, "item_number");
    const [created] = await db
      .insert(evidence)
      .values({
        itemNumber,
        description: input.description,
        categoryId: input.categoryId,
        quantity: input.quantity,
        unitLabel: input.unitLabel,
        location: input.location,
        status: input.status,
        incidentId: input.incidentId,
        custodianId: input.custodianId ?? ctx.user.id,
        collectedAt: input.collectedAt,
        collectedFrom: input.collectedFrom,
        notes: input.notes,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning();

    await db.insert(evidenceEvents).values({
      evidenceId: created!.id,
      type: "COLLECTED",
      toLocation: input.location,
      toCustodianId: input.custodianId ?? ctx.user.id,
      actorId: ctx.user.id,
      notes: "Item booked into custody",
    });

    if (input.customFields) await writeCustomValues("evidence", created!.id, input.customFields);

    await recordAudit({ action: "evidence.created", resourceType: "evidence", resourceId: created!.id, summary: `Booked in evidence ${itemNumber}` });
    await recordTimeline({ recordType: "evidence", recordId: created!.id, type: "CREATED", message: `Item booked in by ${ctx.user.name}` });
    if (created!.incidentId) {
      await recordTimeline({ recordType: "incident", recordId: created!.incidentId, type: "EVIDENCE", message: `Evidence ${itemNumber} booked in` });
    }
    return created;
  },

  async update(ctx: RequestContext, id: string, input: EvidenceUpsertInput) {
    assertCan(ctx, "evidence.edit");
    const [existing] = await db.select().from(evidence).where(and(eq(evidence.id, id), isNull(evidence.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This evidence item does not exist.");

    const [updated] = await db
      .update(evidence)
      .set({
        description: input.description,
        categoryId: input.categoryId,
        quantity: input.quantity,
        unitLabel: input.unitLabel,
        location: input.location,
        status: input.status,
        incidentId: input.incidentId,
        custodianId: input.custodianId,
        collectedAt: input.collectedAt,
        collectedFrom: input.collectedFrom,
        notes: input.notes,
        updatedById: ctx.user.id,
      })
      .where(eq(evidence.id, id))
      .returning();

    if (input.customFields) await writeCustomValues("evidence", id, input.customFields);
    await recordAudit({
      action: "evidence.updated",
      resourceType: "evidence",
      resourceId: id,
      summary: `Updated evidence ${existing.itemNumber}`,
      previousValue: { status: existing.status, location: existing.location },
      newValue: { status: input.status, location: input.location },
    });
    return updated;
  },

  /** Records an append-only custody event (transfer, examination, release...). */
  async transfer(ctx: RequestContext, id: string, input: { type: string; toLocation?: string | null; toCustodianId?: string | null; notes?: string | null }) {
    assertCan(ctx, "evidence.transfer");
    const [existing] = await db.select().from(evidence).where(and(eq(evidence.id, id), isNull(evidence.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This evidence item does not exist.");

    const [event] = await db
      .insert(evidenceEvents)
      .values({
        evidenceId: id,
        type: input.type,
        fromLocation: existing.location,
        toLocation: input.toLocation ?? null,
        fromCustodianId: existing.custodianId,
        toCustodianId: input.toCustodianId ?? null,
        actorId: ctx.user.id,
        notes: input.notes ?? null,
      })
      .returning();

    await db
      .update(evidence)
      .set({
        location: input.toLocation ?? existing.location,
        custodianId: input.toCustodianId ?? existing.custodianId,
        status: input.type === "RELEASE" ? "RELEASED" : existing.status,
        updatedById: ctx.user.id,
      })
      .where(eq(evidence.id, id));

    await recordTimeline({
      recordType: "evidence",
      recordId: id,
      type: "CUSTODY",
      message: `${input.type} recorded by ${ctx.user.name}${input.notes ? ` - ${input.notes}` : ""}`,
    });
    await recordAudit({
      action: "evidence.custody",
      resourceType: "evidence",
      resourceId: id,
      summary: `Custody event ${input.type} on ${existing.itemNumber}`,
      previousValue: { location: existing.location, custodianId: existing.custodianId },
      newValue: { location: input.toLocation, custodianId: input.toCustodianId, notes: input.notes },
    });
    return event;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "evidence.delete");
    const [existing] = await db.select().from(evidence).where(eq(evidence.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This evidence item does not exist.");
    await db.update(evidence).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(evidence.id, id));
    await recordAudit({ action: "evidence.deleted", resourceType: "evidence", resourceId: id, summary: `Deleted evidence ${existing.itemNumber}` });
    return { id };
  },
};
