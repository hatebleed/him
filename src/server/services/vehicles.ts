import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  alerts,
  bolos,
  departments,
  incidentVehicles,
  incidents,
  personVehicles,
  persons,
  vehicles,
} from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { VehicleUpsertInput } from "@/lib/validation/people";

import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { readCustomValues, readCustomValuesForRecord, writeCustomValues } from "./custom-fields";
import { combine, multi, orderByDirection, single, type ListParams } from "./pagination";
import { nextReference, REFERENCE_PREFIXES } from "./reference";

const sortColumns = {
  registration: vehicles.registration,
  reference: vehicles.reference,
  make: vehicles.make,
  status: vehicles.status,
  createdAt: vehicles.createdAt,
} as const;

export const vehicleService = {
  async list(ctx: RequestContext, params: ListParams) {
    assertCan(ctx, "vehicles.view");
    const conditions: SQL[] = [isNull(vehicles.deletedAt)];

    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(
        ilike(vehicles.registration, term),
        ilike(vehicles.reference, term),
        ilike(vehicles.make, term),
        ilike(vehicles.model, term),
        ilike(vehicles.vin, term),
        ilike(vehicles.colour, term),
      );
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(vehicles.status, statuses));
    const department = single(params.filters.department);
    if (department) conditions.push(eq(vehicles.departmentId, department));

    const where = combine(...conditions);
    const sortColumn = sortColumns[(params.sort ?? "createdAt") as keyof typeof sortColumns] ?? vehicles.createdAt;

    const rows = await db
      .select({
        id: vehicles.id,
        reference: vehicles.reference,
        registration: vehicles.registration,
        make: vehicles.make,
        model: vehicles.model,
        year: vehicles.year,
        colour: vehicles.colour,
        bodyType: vehicles.bodyType,
        status: vehicles.status,
        departmentId: vehicles.departmentId,
        departmentName: departments.name,
        createdAt: vehicles.createdAt,
      })
      .from(vehicles)
      .leftJoin(departments, eq(departments.id, vehicles.departmentId))
      .where(where)
      .orderBy(orderByDirection(sortColumn, params.dir))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(vehicles).where(where);
    const ids = rows.map((row) => row.id);
    const customValues = await readCustomValues("vehicle", ids);

    const ownerRows = ids.length
      ? await db
          .select({ vehicleId: personVehicles.vehicleId, personId: persons.id, firstName: persons.firstName, lastName: persons.lastName, reference: persons.reference })
          .from(personVehicles)
          .innerJoin(persons, eq(persons.id, personVehicles.personId))
          .where(inArray(personVehicles.vehicleId, ids))
      : [];

    const ownersByVehicle = new Map<string, Array<{ id: string; name: string; reference: string }>>();
    for (const row of ownerRows) {
      const list = ownersByVehicle.get(row.vehicleId) ?? [];
      list.push({ id: row.personId, name: `${row.firstName} ${row.lastName}`, reference: row.reference });
      ownersByVehicle.set(row.vehicleId, list);
    }

    return {
      rows: rows.map((row) => ({
        ...row,
        owners: ownersByVehicle.get(row.id) ?? [],
        customFields: customValues.get(row.id) ?? {},
      })),
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "vehicles.view");
    const [vehicle] = await db
      .select({
        id: vehicles.id,
        reference: vehicles.reference,
        registration: vehicles.registration,
        make: vehicles.make,
        model: vehicles.model,
        year: vehicles.year,
        colour: vehicles.colour,
        bodyType: vehicles.bodyType,
        fuelType: vehicles.fuelType,
        vin: vehicles.vin,
        engineSize: vehicles.engineSize,
        status: vehicles.status,
        categoryId: vehicles.categoryId,
        departmentId: vehicles.departmentId,
        departmentName: departments.name,
        notes: vehicles.notes,
        createdAt: vehicles.createdAt,
        updatedAt: vehicles.updatedAt,
      })
      .from(vehicles)
      .leftJoin(departments, eq(departments.id, vehicles.departmentId))
      .where(and(eq(vehicles.id, id), isNull(vehicles.deletedAt)))
      .limit(1);

    if (!vehicle) throw AppError.notFound("This vehicle does not exist or has been deleted.");

    const [owners, incidentLinks, alertRows, boloRows, customFields] = await Promise.all([
      db
        .select({
          id: personVehicles.id,
          relationship: personVehicles.relationship,
          isPrimary: personVehicles.isPrimary,
          personId: persons.id,
          personReference: persons.reference,
          firstName: persons.firstName,
          lastName: persons.lastName,
        })
        .from(personVehicles)
        .innerJoin(persons, eq(persons.id, personVehicles.personId))
        .where(eq(personVehicles.vehicleId, id)),
      db
        .select({
          id: incidentVehicles.id,
          role: incidentVehicles.role,
          incidentId: incidents.id,
          reference: incidents.reference,
          title: incidents.title,
          status: incidents.status,
          reportedAt: incidents.reportedAt,
        })
        .from(incidentVehicles)
        .innerJoin(incidents, eq(incidents.id, incidentVehicles.incidentId))
        .where(eq(incidentVehicles.vehicleId, id))
        .orderBy(desc(incidents.reportedAt))
        .limit(50),
      db.select().from(alerts).where(eq(alerts.vehicleId, id)).orderBy(desc(alerts.createdAt)).limit(20),
      db.select().from(bolos).where(eq(bolos.vehicleId, id)).orderBy(desc(bolos.createdAt)).limit(20),
      readCustomValuesForRecord("vehicle", id),
    ]);

    return { ...vehicle, owners, incidents: incidentLinks, alerts: alertRows, bolos: boloRows, customFields };
  },

  async create(ctx: RequestContext, input: VehicleUpsertInput) {
    assertCan(ctx, "vehicles.create");
    const reference = await nextReference(vehicles, REFERENCE_PREFIXES.vehicle);
    const [created] = await db
      .insert(vehicles)
      .values({
        reference,
        registration: input.registration.toUpperCase(),
        make: input.make,
        model: input.model,
        year: input.year ?? null,
        colour: input.colour,
        bodyType: input.bodyType,
        fuelType: input.fuelType,
        vin: input.vin,
        engineSize: input.engineSize,
        status: input.status,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        notes: input.notes,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning();

    if (!created) throw AppError.badRequest("The vehicle could not be created.");
    if (input.customFields) await writeCustomValues("vehicle", created.id, input.customFields);

    await recordAudit({
      action: "vehicle.created",
      resourceType: "vehicle",
      resourceId: created.id,
      summary: `Created vehicle ${created.registration}`,
      newValue: { registration: created.registration },
    });
    await recordTimeline({ recordType: "vehicle", recordId: created.id, type: "CREATED", message: `Record created by ${ctx.user.name}` });
    return created;
  },

  async update(ctx: RequestContext, id: string, input: VehicleUpsertInput) {
    assertCan(ctx, "vehicles.edit");
    const [existing] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), isNull(vehicles.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This vehicle does not exist.");

    const [updated] = await db
      .update(vehicles)
      .set({
        registration: input.registration.toUpperCase(),
        make: input.make,
        model: input.model,
        year: input.year ?? null,
        colour: input.colour,
        bodyType: input.bodyType,
        fuelType: input.fuelType,
        vin: input.vin,
        engineSize: input.engineSize,
        status: input.status,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        notes: input.notes,
        updatedById: ctx.user.id,
      })
      .where(eq(vehicles.id, id))
      .returning();

    if (input.customFields) await writeCustomValues("vehicle", id, input.customFields);
    if (existing.status !== input.status) {
      await recordTimeline({ recordType: "vehicle", recordId: id, type: "STATUS", message: `Status changed from ${existing.status} to ${input.status}` });
    }
    await recordAudit({
      action: "vehicle.updated",
      resourceType: "vehicle",
      resourceId: id,
      summary: `Updated vehicle ${existing.registration}`,
      previousValue: { status: existing.status },
      newValue: { status: input.status },
    });
    return updated;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "vehicles.delete");
    const [existing] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), isNull(vehicles.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This vehicle does not exist.");
    await db.update(vehicles).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(vehicles.id, id));
    await recordAudit({ action: "vehicle.deleted", resourceType: "vehicle", resourceId: id, summary: `Deleted vehicle ${existing.registration}` });
    return { id };
  },

  async search(ctx: RequestContext, term: string, limit = 10) {
    assertCan(ctx, "vehicles.view");
    const query = `%${term}%`;
    return db
      .select({ id: vehicles.id, reference: vehicles.reference, registration: vehicles.registration, make: vehicles.make, model: vehicles.model })
      .from(vehicles)
      .where(and(isNull(vehicles.deletedAt), or(ilike(vehicles.registration, query), ilike(vehicles.reference, query), ilike(vehicles.model, query))))
      .limit(limit);
  },
};
