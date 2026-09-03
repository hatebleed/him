import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { alerts, bolos, incidents, persons, users, vehicles, warrants } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { AlertUpsertInput, BoloUpsertInput, WarrantUpsertInput } from "@/lib/validation/records";

import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { notificationService } from "../notifications/service";
import { getUserIdsWithPermission } from "../permissions/service";
import { combine, multi, single, type ListParams } from "./pagination";
import { nextReference, REFERENCE_PREFIXES } from "./reference";

type ListOptions = ListParams;

// ---------------------------------------------------------------------------
// Warrants
// ---------------------------------------------------------------------------

export const warrantService = {
  async list(ctx: RequestContext, params: ListOptions) {
    assertCan(ctx, "warrants.view");
    const conditions: SQL[] = [isNull(warrants.deletedAt)];
    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(
        ilike(warrants.reference, term),
        ilike(warrants.description, term),
        ilike(warrants.issuingAuthority, term),
        ilike(persons.lastName, term),
        ilike(persons.firstName, term),
      );
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(warrants.status, statuses));
    const where = combine(...conditions);

    const rows = await db
      .select({
        id: warrants.id,
        reference: warrants.reference,
        type: warrants.type,
        status: warrants.status,
        description: warrants.description,
        issuingAuthority: warrants.issuingAuthority,
        issuedAt: warrants.issuedAt,
        expiresAt: warrants.expiresAt,
        personId: warrants.personId,
        personReference: persons.reference,
        personName: sql_concat(persons.firstName, persons.lastName),
        createdAt: warrants.createdAt,
      })
      .from(warrants)
      .innerJoin(persons, eq(persons.id, warrants.personId))
      .where(where)
      .orderBy(desc(warrants.issuedAt))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(warrants).where(where);
    return envelope(rows, Number(totalRow?.value ?? 0), params);
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "warrants.view");
    const [row] = await db
      .select({
        id: warrants.id,
        reference: warrants.reference,
        type: warrants.type,
        status: warrants.status,
        description: warrants.description,
        issuingAuthority: warrants.issuingAuthority,
        issuedAt: warrants.issuedAt,
        expiresAt: warrants.expiresAt,
        executedAt: warrants.executedAt,
        notes: warrants.notes,
        personId: warrants.personId,
        personReference: persons.reference,
        personName: sql_concat(persons.firstName, persons.lastName),
        createdAt: warrants.createdAt,
        updatedAt: warrants.updatedAt,
      })
      .from(warrants)
      .innerJoin(persons, eq(persons.id, warrants.personId))
      .where(and(eq(warrants.id, id), isNull(warrants.deletedAt)))
      .limit(1);
    if (!row) throw AppError.notFound("This warrant does not exist.");
    return row;
  },

  async create(ctx: RequestContext, input: WarrantUpsertInput) {
    assertCan(ctx, "warrants.create");
    const reference = await nextReference(warrants, REFERENCE_PREFIXES.warrant);
    const [created] = await db
      .insert(warrants)
      .values({
        reference,
        personId: input.personId,
        type: input.type,
        status: input.status,
        description: input.description,
        issuingAuthority: input.issuingAuthority,
        issuedAt: input.issuedAt ?? new Date(),
        expiresAt: input.expiresAt,
        notes: input.notes,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning();
    await recordAudit({ action: "warrant.created", resourceType: "warrant", resourceId: created!.id, summary: `Created warrant ${reference}` });
    await recordTimeline({ recordType: "warrant", recordId: created!.id, type: "CREATED", message: `Warrant created by ${ctx.user.name}` });
    await recordTimeline({ recordType: "person", recordId: input.personId, type: "WARRANT", message: `Warrant ${reference} recorded` });
    return created;
  },

  async update(ctx: RequestContext, id: string, input: WarrantUpsertInput) {
    assertCan(ctx, "warrants.edit");
    const [existing] = await db.select().from(warrants).where(and(eq(warrants.id, id), isNull(warrants.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This warrant does not exist.");
    const [updated] = await db
      .update(warrants)
      .set({
        personId: input.personId,
        type: input.type,
        status: input.status,
        description: input.description,
        issuingAuthority: input.issuingAuthority,
        issuedAt: input.issuedAt ?? existing.issuedAt,
        expiresAt: input.expiresAt,
        notes: input.notes,
        updatedById: ctx.user.id,
      })
      .where(eq(warrants.id, id))
      .returning();
    await recordAudit({
      action: "warrant.updated",
      resourceType: "warrant",
      resourceId: id,
      summary: `Updated warrant ${existing.reference}`,
      previousValue: { status: existing.status },
      newValue: { status: input.status },
    });
    return updated;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "warrants.delete");
    const [existing] = await db.select().from(warrants).where(eq(warrants.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This warrant does not exist.");
    await db.update(warrants).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(warrants.id, id));
    await recordAudit({ action: "warrant.deleted", resourceType: "warrant", resourceId: id, summary: `Deleted warrant ${existing.reference}` });
    return { id };
  },
};

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const alertService = {
  async list(ctx: RequestContext, params: ListOptions) {
    assertCan(ctx, "alerts.view");
    const conditions: SQL[] = [isNull(alerts.deletedAt)];
    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(ilike(alerts.reference, term), ilike(alerts.subject, term), ilike(alerts.description, term));
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(alerts.status, statuses));
    const priorities = multi(params.filters.priority);
    if (priorities.length) conditions.push(inArray(alerts.priority, priorities));
    const type = single(params.filters.type);
    if (type) conditions.push(eq(alerts.type, type));
    const where = combine(...conditions);

    const rows = await db
      .select({
        id: alerts.id,
        reference: alerts.reference,
        type: alerts.type,
        subject: alerts.subject,
        description: alerts.description,
        priority: alerts.priority,
        status: alerts.status,
        expiresAt: alerts.expiresAt,
        acknowledgedAt: alerts.acknowledgedAt,
        personId: alerts.personId,
        vehicleId: alerts.vehicleId,
        incidentId: alerts.incidentId,
        createdAt: alerts.createdAt,
      })
      .from(alerts)
      .where(where)
      .orderBy(desc(alerts.createdAt))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(alerts).where(where);
    return envelope(rows, Number(totalRow?.value ?? 0), params);
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "alerts.view");
    const [row] = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.id, id), isNull(alerts.deletedAt)))
      .limit(1);
    if (!row) throw AppError.notFound("This alert does not exist.");
    const [creator] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.createdById ?? "")).limit(1);
    return { ...row, createdByName: creator?.name ?? null };
  },

  async create(ctx: RequestContext, input: AlertUpsertInput) {
    assertCan(ctx, "alerts.create");
    const reference = await nextReference(alerts, REFERENCE_PREFIXES.alert);
    const [created] = await db
      .insert(alerts)
      .values({
        reference,
        type: input.type,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        status: input.status,
        categoryId: input.categoryId,
        personId: input.personId,
        vehicleId: input.vehicleId,
        incidentId: input.incidentId,
        expiresAt: input.expiresAt,
        notes: input.notes,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning();

    await recordAudit({ action: "alert.created", resourceType: "alert", resourceId: created!.id, summary: `Created alert ${reference}` });
    await recordTimeline({ recordType: "alert", recordId: created!.id, type: "CREATED", message: `Alert created by ${ctx.user.name}` });

    if (input.notify) {
      const recipients = await getUserIdsWithPermission("alerts.view");
      await notificationService.sendToMany(recipients, {
        type: "ALERT",
        category: "ALERTS",
        priority: input.priority,
        title: `New alert: ${input.subject}`,
        message: input.description ?? input.subject,
        resourceType: "alert",
        resourceId: created!.id,
      });
    }
    return created;
  },

  async update(ctx: RequestContext, id: string, input: AlertUpsertInput) {
    assertCan(ctx, "alerts.edit");
    const [existing] = await db.select().from(alerts).where(and(eq(alerts.id, id), isNull(alerts.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This alert does not exist.");
    const [updated] = await db
      .update(alerts)
      .set({
        type: input.type,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        status: input.status,
        categoryId: input.categoryId,
        personId: input.personId,
        vehicleId: input.vehicleId,
        incidentId: input.incidentId,
        expiresAt: input.expiresAt,
        notes: input.notes,
        updatedById: ctx.user.id,
      })
      .where(eq(alerts.id, id))
      .returning();
    await recordAudit({
      action: "alert.updated",
      resourceType: "alert",
      resourceId: id,
      summary: `Updated alert ${existing.reference}`,
      previousValue: { status: existing.status },
      newValue: { status: input.status },
    });
    return updated;
  },

  async acknowledge(ctx: RequestContext, id: string) {
    assertCan(ctx, "alerts.acknowledge");
    const [existing] = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This alert does not exist.");
    const [updated] = await db
      .update(alerts)
      .set({ status: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedById: ctx.user.id })
      .where(eq(alerts.id, id))
      .returning();
    await recordTimeline({ recordType: "alert", recordId: id, type: "STATUS", message: `Acknowledged by ${ctx.user.name}` });
    await recordAudit({ action: "alert.acknowledged", resourceType: "alert", resourceId: id, summary: `Acknowledged alert ${existing.reference}` });
    return updated;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "alerts.delete");
    const [existing] = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This alert does not exist.");
    await db.update(alerts).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(alerts.id, id));
    await recordAudit({ action: "alert.deleted", resourceType: "alert", resourceId: id, summary: `Deleted alert ${existing.reference}` });
    return { id };
  },
};

// ---------------------------------------------------------------------------
// BOLOs
// ---------------------------------------------------------------------------

export const boloService = {
  async list(ctx: RequestContext, params: ListOptions) {
    assertCan(ctx, "bolos.view");
    const conditions: SQL[] = [isNull(bolos.deletedAt)];
    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(ilike(bolos.reference, term), ilike(bolos.subject, term), ilike(bolos.description, term));
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(bolos.status, statuses));
    const where = combine(...conditions);

    const rows = await db
      .select({
        id: bolos.id,
        reference: bolos.reference,
        subject: bolos.subject,
        description: bolos.description,
        status: bolos.status,
        priority: bolos.priority,
        expiresAt: bolos.expiresAt,
        personId: bolos.personId,
        vehicleId: bolos.vehicleId,
        incidentId: bolos.incidentId,
        createdAt: bolos.createdAt,
      })
      .from(bolos)
      .where(where)
      .orderBy(desc(bolos.createdAt))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(bolos).where(where);
    return envelope(rows, Number(totalRow?.value ?? 0), params);
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "bolos.view");
    const [row] = await db
      .select()
      .from(bolos)
      .where(and(eq(bolos.id, id), isNull(bolos.deletedAt)))
      .limit(1);
    if (!row) throw AppError.notFound("This BOLO does not exist.");
    const [person, vehicle, incident] = await Promise.all([
      row.personId ? db.select({ id: persons.id, reference: persons.reference, firstName: persons.firstName, lastName: persons.lastName }).from(persons).where(eq(persons.id, row.personId)).limit(1) : [],
      row.vehicleId ? db.select({ id: vehicles.id, registration: vehicles.registration, make: vehicles.make, model: vehicles.model }).from(vehicles).where(eq(vehicles.id, row.vehicleId)).limit(1) : [],
      row.incidentId ? db.select({ id: incidents.id, reference: incidents.reference, title: incidents.title }).from(incidents).where(eq(incidents.id, row.incidentId)).limit(1) : [],
    ]);
    return { ...row, person: person[0] ?? null, vehicle: vehicle[0] ?? null, incident: incident[0] ?? null };
  },

  async create(ctx: RequestContext, input: BoloUpsertInput) {
    assertCan(ctx, "bolos.create");
    const reference = await nextReference(bolos, REFERENCE_PREFIXES.bolo);
    const [created] = await db
      .insert(bolos)
      .values({
        reference,
        subject: input.subject,
        description: input.description,
        status: input.status,
        priority: input.priority,
        personId: input.personId,
        vehicleId: input.vehicleId,
        incidentId: input.incidentId,
        expiresAt: input.expiresAt,
        notes: input.notes,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning();
    await recordAudit({ action: "bolo.created", resourceType: "bolo", resourceId: created!.id, summary: `Created BOLO ${reference}` });
    await recordTimeline({ recordType: "bolo", recordId: created!.id, type: "CREATED", message: `BOLO created by ${ctx.user.name}` });
    return created;
  },

  async update(ctx: RequestContext, id: string, input: BoloUpsertInput) {
    assertCan(ctx, "bolos.edit");
    const [existing] = await db.select().from(bolos).where(and(eq(bolos.id, id), isNull(bolos.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This BOLO does not exist.");
    const [updated] = await db
      .update(bolos)
      .set({
        subject: input.subject,
        description: input.description,
        status: input.status,
        priority: input.priority,
        personId: input.personId,
        vehicleId: input.vehicleId,
        incidentId: input.incidentId,
        expiresAt: input.expiresAt,
        notes: input.notes,
        updatedById: ctx.user.id,
      })
      .where(eq(bolos.id, id))
      .returning();
    await recordAudit({
      action: "bolo.updated",
      resourceType: "bolo",
      resourceId: id,
      summary: `Updated BOLO ${existing.reference}`,
      previousValue: { status: existing.status },
      newValue: { status: input.status },
    });
    return updated;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "bolos.delete");
    const [existing] = await db.select().from(bolos).where(eq(bolos.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This BOLO does not exist.");
    await db.update(bolos).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(bolos.id, id));
    await recordAudit({ action: "bolo.deleted", resourceType: "bolo", resourceId: id, summary: `Deleted BOLO ${existing.reference}` });
    return { id };
  },
};

// Shared helpers ------------------------------------------------------------

function sql_concat(first: typeof persons.firstName, last: typeof persons.lastName) {
  return sql<string>`concat(${first}, ' ', ${last})`.as("person_name");
}

function envelope<T>(rows: T[], total: number, params: ListParams) {
  return {
    rows,
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
