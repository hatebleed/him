import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  alerts,
  bolos,
  departments,
  incidentParticipants,
  incidents,
  personAddresses,
  personContacts,
  personIdentifiers,
  persons,
  personVehicles,
  reports,
  vehicles,
  warrants,
} from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { PersonUpsertInput } from "@/lib/validation/people";

import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { combine, multi, orderByDirection, parseListParams, single, type ListParams, type ListResult } from "./pagination";
import { nextReference, REFERENCE_PREFIXES } from "./reference";
import { readCustomValues, readCustomValuesForRecord, writeCustomValues } from "./custom-fields";

export type PersonListItem = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  status: string;
  riskLevel: string | null;
  departmentId: string | null;
  departmentName: string | null;
  dateOfBirth: Date | null;
  createdAt: Date;
  vehicleCount: number;
  incidentCount: number;
};

const sortColumns = {
  reference: persons.reference,
  lastName: persons.lastName,
  firstName: persons.firstName,
  status: persons.status,
  createdAt: persons.createdAt,
} as const;

export const peopleService = {
  async list(ctx: RequestContext, params: ListParams): Promise<ListResult<PersonListItem>> {
    assertCan(ctx, "people.view");
    const conditions: SQL[] = [isNull(persons.deletedAt)];

    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(
        ilike(persons.firstName, term),
        ilike(persons.lastName, term),
        ilike(persons.reference, term),
        ilike(persons.alias, term),
        ilike(persons.occupation, term),
      );
      if (search) conditions.push(search);
    }

    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(persons.status, statuses));
    const department = single(params.filters.department);
    if (department) conditions.push(eq(persons.departmentId, department));
    const risk = single(params.filters.risk);
    if (risk) conditions.push(eq(persons.riskLevel, risk));

    const where = combine(...conditions);
    const sortColumn = sortColumns[(params.sort ?? "createdAt") as keyof typeof sortColumns] ?? persons.createdAt;

    const rows = await db
      .select({
        id: persons.id,
        reference: persons.reference,
        firstName: persons.firstName,
        lastName: persons.lastName,
        status: persons.status,
        riskLevel: persons.riskLevel,
        departmentId: persons.departmentId,
        departmentName: departments.name,
        dateOfBirth: persons.dateOfBirth,
        createdAt: persons.createdAt,
      })
      .from(persons)
      .leftJoin(departments, eq(departments.id, persons.departmentId))
      .where(where)
      .orderBy(orderByDirection(sortColumn, params.dir))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(persons).where(where);
    const ids = rows.map((row) => row.id);

    const vehicleCounts = new Map<string, number>();
    const incidentCounts = new Map<string, number>();
    if (ids.length) {
      const vehicleRows = await db
        .select({ personId: personVehicles.personId, value: count() })
        .from(personVehicles)
        .where(inArray(personVehicles.personId, ids))
        .groupBy(personVehicles.personId);
      for (const row of vehicleRows) vehicleCounts.set(row.personId, Number(row.value));

      const incidentRows = await db
        .select({ personId: incidentParticipants.personId, value: count() })
        .from(incidentParticipants)
        .where(inArray(incidentParticipants.personId, ids))
        .groupBy(incidentParticipants.personId);
      for (const row of incidentRows) incidentCounts.set(row.personId, Number(row.value));
    }

    const customValues = await readCustomValues("person", ids);

    return {
      rows: rows.map((row) => ({
        ...row,
        vehicleCount: vehicleCounts.get(row.id) ?? 0,
        incidentCount: incidentCounts.get(row.id) ?? 0,
        customFields: customValues.get(row.id) ?? {},
      })) as Array<PersonListItem & { customFields: Record<string, unknown> }>,
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "people.view");
    const [person] = await db
      .select({
        id: persons.id,
        reference: persons.reference,
        firstName: persons.firstName,
        lastName: persons.lastName,
        middleName: persons.middleName,
        alias: persons.alias,
        dateOfBirth: persons.dateOfBirth,
        gender: persons.gender,
        nationality: persons.nationality,
        occupation: persons.occupation,
        status: persons.status,
        riskLevel: persons.riskLevel,
        categoryId: persons.categoryId,
        departmentId: persons.departmentId,
        departmentName: departments.name,
        notes: persons.notes,
        createdAt: persons.createdAt,
        updatedAt: persons.updatedAt,
      })
      .from(persons)
      .leftJoin(departments, eq(departments.id, persons.departmentId))
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .limit(1);

    if (!person) throw AppError.notFound("This person record does not exist or has been deleted.");

    const [identifiers, contacts, addresses, vehicleLinks, incidentLinks, warrantRows, alertRows, boloRows, customFields] =
      await Promise.all([
        db.select().from(personIdentifiers).where(eq(personIdentifiers.personId, id)).orderBy(asc(personIdentifiers.type)),
        db.select().from(personContacts).where(eq(personContacts.personId, id)).orderBy(desc(personContacts.isPrimary)),
        db.select().from(personAddresses).where(eq(personAddresses.personId, id)).orderBy(desc(personAddresses.isPrimary)),
        db
          .select({
            id: personVehicles.id,
            relationship: personVehicles.relationship,
            isPrimary: personVehicles.isPrimary,
            startDate: personVehicles.startDate,
            endDate: personVehicles.endDate,
            vehicleId: vehicles.id,
            registration: vehicles.registration,
            make: vehicles.make,
            model: vehicles.model,
            colour: vehicles.colour,
            status: vehicles.status,
          })
          .from(personVehicles)
          .innerJoin(vehicles, eq(vehicles.id, personVehicles.vehicleId))
          .where(eq(personVehicles.personId, id))
          .orderBy(desc(personVehicles.isPrimary)),
        db
          .select({
            id: incidentParticipants.id,
            role: incidentParticipants.role,
            incidentId: incidents.id,
            reference: incidents.reference,
            title: incidents.title,
            status: incidents.status,
            priority: incidents.priority,
            reportedAt: incidents.reportedAt,
          })
          .from(incidentParticipants)
          .innerJoin(incidents, eq(incidents.id, incidentParticipants.incidentId))
          .where(eq(incidentParticipants.personId, id))
          .orderBy(desc(incidents.reportedAt))
          .limit(50),
        db.select().from(warrants).where(eq(warrants.personId, id)).orderBy(desc(warrants.issuedAt)).limit(50),
        db.select().from(alerts).where(eq(alerts.personId, id)).orderBy(desc(alerts.createdAt)).limit(50),
        db.select().from(bolos).where(eq(bolos.personId, id)).orderBy(desc(bolos.createdAt)).limit(50),
        readCustomValuesForRecord("person", id),
      ]);

    const reportRows = await db
      .select({ id: reports.id, reference: reports.reference, title: reports.title, status: reports.status, createdAt: reports.createdAt })
      .from(reports)
      .where(or(...(incidentLinks.length ? [inArray(reports.incidentId, incidentLinks.map((link) => link.incidentId))] : [eq(reports.id, "__none__")])))
      .orderBy(desc(reports.createdAt))
      .limit(20);

    return {
      ...person,
      identifiers,
      contacts,
      addresses,
      vehicles: vehicleLinks,
      incidents: incidentLinks,
      reports: reportRows,
      warrants: warrantRows,
      alerts: alertRows,
      bolos: boloRows,
      customFields,
    };
  },

  async create(ctx: RequestContext, input: PersonUpsertInput) {
    assertCan(ctx, "people.create");
    const reference = await nextReference(persons, REFERENCE_PREFIXES.person);
    const created = await db.transaction(async (tx) => {
      const [person] = await tx
        .insert(persons)
        .values({
          reference,
          firstName: input.firstName,
          lastName: input.lastName,
          middleName: input.middleName,
          alias: input.alias,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          nationality: input.nationality,
          occupation: input.occupation,
          status: input.status,
          riskLevel: input.riskLevel,
          categoryId: input.categoryId,
          departmentId: input.departmentId,
          notes: input.notes,
          createdById: ctx.user.id,
          updatedById: ctx.user.id,
        })
        .returning();

      if (!person) throw AppError.badRequest("The person record could not be created.");

      if (input.identifiers.length) {
        await tx.insert(personIdentifiers).values(
          input.identifiers.map((identifier) => ({
            personId: person.id,
            type: identifier.type,
            value: identifier.value,
            issuingAuthority: identifier.issuingAuthority,
            notes: identifier.notes,
          })),
        );
      }
      if (input.contacts.length) {
        await tx.insert(personContacts).values(
          input.contacts.map((contact) => ({
            personId: person.id,
            type: contact.type,
            value: contact.value,
            label: contact.label,
            isPrimary: contact.isPrimary,
          })),
        );
      }
      if (input.addresses.length) {
        await tx.insert(personAddresses).values(
          input.addresses.map((address) => ({
            personId: person.id,
            type: address.type,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            region: address.region,
            postalCode: address.postalCode,
            country: address.country,
            isPrimary: address.isPrimary,
            fromDate: address.fromDate,
            toDate: address.toDate,
            notes: address.notes,
          })),
        );
      }
      return person;
    });

    if (input.customFields) await writeCustomValues("person", created.id, input.customFields);

    await recordAudit({
      action: "person.created",
      resourceType: "person",
      resourceId: created.id,
      summary: `Created person ${created.reference}`,
      newValue: { reference: created.reference, name: `${created.firstName} ${created.lastName}` },
    });
    await recordTimeline({
      recordType: "person",
      recordId: created.id,
      type: "CREATED",
      message: `Record created by ${ctx.user.name}`,
    });

    return created;
  },

  async update(ctx: RequestContext, id: string, input: PersonUpsertInput) {
    assertCan(ctx, "people.edit");
    const [existing] = await db.select().from(persons).where(and(eq(persons.id, id), isNull(persons.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This person record does not exist.");

    const [updated] = await db
      .update(persons)
      .set({
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        alias: input.alias,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        nationality: input.nationality,
        occupation: input.occupation,
        status: input.status,
        riskLevel: input.riskLevel,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        notes: input.notes,
        updatedById: ctx.user.id,
      })
      .where(eq(persons.id, id))
      .returning();

    // Sub-records are replaced wholesale: the editor submits the full set.
    await db.transaction(async (tx) => {
      await tx.delete(personIdentifiers).where(eq(personIdentifiers.personId, id));
      await tx.delete(personContacts).where(eq(personContacts.personId, id));
      await tx.delete(personAddresses).where(eq(personAddresses.personId, id));

      if (input.identifiers.length) {
        await tx.insert(personIdentifiers).values(
          input.identifiers.map((identifier) => ({
            personId: id,
            type: identifier.type,
            value: identifier.value,
            issuingAuthority: identifier.issuingAuthority,
            notes: identifier.notes,
          })),
        );
      }
      if (input.contacts.length) {
        await tx.insert(personContacts).values(
          input.contacts.map((contact) => ({
            personId: id,
            type: contact.type,
            value: contact.value,
            label: contact.label,
            isPrimary: contact.isPrimary,
          })),
        );
      }
      if (input.addresses.length) {
        await tx.insert(personAddresses).values(
          input.addresses.map((address) => ({
            personId: id,
            type: address.type,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            region: address.region,
            postalCode: address.postalCode,
            country: address.country,
            isPrimary: address.isPrimary,
            fromDate: address.fromDate,
            toDate: address.toDate,
            notes: address.notes,
          })),
        );
      }
    });

    if (input.customFields) await writeCustomValues("person", id, input.customFields);

    if (existing.status !== input.status) {
      await recordTimeline({
        recordType: "person",
        recordId: id,
        type: "STATUS",
        message: `Status changed from ${existing.status} to ${input.status}`,
      });
    }

    await recordAudit({
      action: "person.updated",
      resourceType: "person",
      resourceId: id,
      summary: `Updated person ${existing.reference}`,
      previousValue: { status: existing.status, lastName: existing.lastName },
      newValue: { status: input.status, lastName: input.lastName },
    });

    return updated;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "people.delete");
    const [existing] = await db.select().from(persons).where(and(eq(persons.id, id), isNull(persons.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This person record does not exist.");

    await db.update(persons).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(persons.id, id));
    await recordAudit({
      action: "person.deleted",
      resourceType: "person",
      resourceId: id,
      summary: `Deleted person ${existing.reference}`,
      previousValue: { reference: existing.reference },
    });
    return { id };
  },

  /** Link an existing vehicle to a person. */
  async linkVehicle(ctx: RequestContext, personId: string, input: { vehicleId: string; relationship: string; isPrimary: boolean; startDate?: Date | null; endDate?: Date | null; notes?: string | null }) {
    assertCan(ctx, "people.edit");
    const [person] = await db.select({ id: persons.id }).from(persons).where(and(eq(persons.id, personId), isNull(persons.deletedAt))).limit(1);
    if (!person) throw AppError.notFound("This person record does not exist.");
    const [vehicle] = await db.select({ id: vehicles.id, registration: vehicles.reference }).from(vehicles).where(and(eq(vehicles.id, input.vehicleId), isNull(vehicles.deletedAt))).limit(1);
    if (!vehicle) throw AppError.notFound("This vehicle does not exist.");

    await db
      .insert(personVehicles)
      .values({
        personId,
        vehicleId: input.vehicleId,
        relationship: input.relationship,
        isPrimary: input.isPrimary,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        notes: input.notes ?? null,
      })
      .onConflictDoNothing();

    await recordTimeline({
      recordType: "person",
      recordId: personId,
      type: "RELATIONSHIP",
      message: `Linked vehicle ${vehicle.registration}`,
    });
    await recordTimeline({
      recordType: "vehicle",
      recordId: input.vehicleId,
      type: "RELATIONSHIP",
      message: `Linked to person ${(await db.select({ reference: persons.reference }).from(persons).where(eq(persons.id, personId)).limit(1))[0]?.reference ?? personId}`,
    });
    await recordAudit({
      action: "person.vehicle.linked",
      resourceType: "person",
      resourceId: personId,
      summary: `Linked vehicle ${vehicle.registration}`,
      newValue: { vehicleId: input.vehicleId, relationship: input.relationship },
    });
    return { ok: true };
  },

  async unlinkVehicle(ctx: RequestContext, personId: string, vehicleId: string) {
    assertCan(ctx, "people.edit");
    await db.delete(personVehicles).where(and(eq(personVehicles.personId, personId), eq(personVehicles.vehicleId, vehicleId)));
    await recordAudit({
      action: "person.vehicle.unlinked",
      resourceType: "person",
      resourceId: personId,
      summary: "Removed vehicle link",
      newValue: { vehicleId },
    });
    await recordTimeline({ recordType: "person", recordId: personId, type: "RELATIONSHIP", message: "Removed vehicle link" });
    return { ok: true };
  },

  /** Lightweight lookup used by pickers and the command palette. */
  async search(ctx: RequestContext, term: string, limit = 10) {
    assertCan(ctx, "people.view");
    const query = `%${term}%`;
    return db
      .select({
        id: persons.id,
        reference: persons.reference,
        firstName: persons.firstName,
        lastName: persons.lastName,
        status: persons.status,
      })
      .from(persons)
      .where(and(isNull(persons.deletedAt), or(ilike(persons.lastName, query), ilike(persons.firstName, query), ilike(persons.reference, query))))
      .limit(limit);
  },
};

export { parseListParams };
