import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db, pool } from "@/lib/db/client";
import { auditLogs, incidents, persons, reports, tasks, timelineEntries } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { assertCan, type RequestContext } from "@/server/context";
import { loadUserPermissions } from "@/server/permissions/service";
import { peopleService } from "@/server/services/people";
import { incidentService } from "@/server/services/incidents";
import { reportService } from "@/server/services/reports";
import { taskService } from "@/server/services/tasks";
import { adminConfigService } from "@/server/services/admin-config";
import { getStatuses } from "@/server/configuration/service";
import { recordTimeline } from "@/server/audit/audit";
import { runInContext } from "./helpers/context";

/**
 * Integration tests run against the real PostgreSQL database using the real
 * services, so authorisation, validation, auditing and versioning are all
 * exercised end to end (without going through HTTP).
 */
async function contextFor(username: string): Promise<RequestContext> {
  const { users } = await import("@/lib/db/schema");
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) throw new Error(`Seed user "${username}" is missing. Run npm run db:seed.`);

  const { permissions, roles } = await loadUserPermissions(user.id);
  return {
    requestId: crypto.randomUUID(),
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      jobTitle: user.jobTitle,
      badgeNumber: user.badgeNumber,
      avatarUrl: user.avatarUrl,
      status: user.status,
      departmentId: user.departmentId,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      sessionExpiresAt: new Date(Date.now() + 3_600_000),
    },
    permissions,
    roles,
    ip: "127.0.0.1",
    userAgent: "vitest",
    path: "/tests",
  };
}

describe("service layer integration", () => {
  let admin: RequestContext;
  let readonly: RequestContext;
  let createdPersonId = "";
  let createdIncidentId = "";

  beforeAll(async () => {
    admin = await contextFor("admin");
    readonly = await contextFor("readonly");
  });

  afterAll(async () => {
    if (createdPersonId) await db.delete(persons).where(eq(persons.id, createdPersonId));
    if (createdIncidentId) await db.delete(incidents).where(eq(incidents.id, createdIncidentId));
    await pool.end();
  });

  it("enforces permissions in the service layer, not just the UI", async () => {
    expect(() => assertCan(admin, "people.create")).not.toThrow();
    expect(() => assertCan(readonly, "people.create")).toThrow(AppError);
    expect(readonly.permissions.has("people.view")).toBe(true);
  });

  it("creates a person record with contacts and writes timeline + audit entries", async () => {
    await runInContext(admin, async () => {
      const person = await peopleService.create(admin, {
        firstName: "Test",
        lastName: `Person-${Date.now()}`,
        middleName: null,
        alias: null,
        dateOfBirth: null,
        gender: null,
        nationality: null,
        occupation: null,
        status: "ACTIVE",
        riskLevel: null,
        categoryId: null,
        departmentId: null,
        notes: null,
        identifiers: [{ type: "NATIONAL_ID", value: "TEST-1", issuingAuthority: null, notes: null }],
        contacts: [{ type: "EMAIL", value: "test.person@example.test", label: null, isPrimary: true }],
        addresses: [],
      });
      createdPersonId = person.id;

      const timeline = await db
        .select()
        .from(timelineEntries)
        .where(eq(timelineEntries.recordId, person.id));
      expect(timeline.length).toBeGreaterThan(0);

      const audit = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, person.id));
      expect(audit.some((entry) => entry.action === "person.created")).toBe(true);
    });
  });

  it("refuses to create a person without the people.create permission", async () => {
    await expect(
      peopleService.create(readonly, {
        firstName: "No",
        lastName: "Access",
        middleName: null,
        alias: null,
        dateOfBirth: null,
        gender: null,
        nationality: null,
        occupation: null,
        status: "ACTIVE",
        riskLevel: null,
        categoryId: null,
        departmentId: null,
        notes: null,
        identifiers: [],
        contacts: [],
        addresses: [],
      }),
    ).rejects.toThrow(AppError);
  });

  it("creates an incident, links a person and records the relationship on both records", async () => {
    await runInContext(admin, async () => {
      const incident = await incidentService.create(admin, {
        title: "Automated test incident",
        description: "Created by the integration suite.",
        status: "NEW",
        priority: "MEDIUM",
        categoryId: null,
        departmentId: null,
        location: null,
        latitude: null,
        longitude: null,
        occurredAt: null,
        reportedAt: null,
        supervisorId: null,
      });
      createdIncidentId = incident.id;

      await incidentService.linkPerson(admin, incident.id, { personId: createdPersonId, role: "WITNESS", notes: null });

      const detail = await incidentService.get(admin, incident.id);
      expect(detail.participants.some((participant) => participant.personId === createdPersonId)).toBe(true);

      const personDetail = await peopleService.get(admin, createdPersonId);
      expect(personDetail.incidents.some((entry) => entry.incidentId === incident.id)).toBe(true);
    });
  });

  it("runs the report lifecycle and stores an immutable version per change", async () => {
    await runInContext(admin, async () => {
      const report = await reportService.create(admin, {
        title: "Automated test report",
        body: "First draft",
        status: "DRAFT",
        incidentId: null,
        caseId: null,
        categoryId: null,
      });
      const submitted = await reportService.transition(admin, report.id, "SUBMIT");
      expect(submitted?.status).toBe("SUBMITTED");

      const updated = await reportService.update(admin, report.id, {
        title: "Automated test report",
        body: "Second version",
        status: "SUBMITTED",
        incidentId: null,
        caseId: null,
        categoryId: null,
      });
      expect(updated?.currentVersion).toBe(3);

      const detail = await reportService.get(admin, report.id);
      expect(detail.versions.length).toBeGreaterThanOrEqual(3);

      const approved = await reportService.transition(admin, report.id, "APPROVE");
      expect(approved?.status).toBe("APPROVED");

      // Locked reports cannot be edited.
      await reportService.transition(admin, report.id, "FINALISE");
      await expect(
        reportService.update(admin, report.id, { title: "Nope", body: "Nope", status: "FINAL", incidentId: null, caseId: null, categoryId: null }),
      ).rejects.toThrow(AppError);

      await db.delete(reports).where(eq(reports.id, report.id));
    });
  });

  it("exposes configured statuses from the database", async () => {
    const statuses = await getStatuses("incident");
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.some((status) => status.isClosed)).toBe(true);
  });

  it("validates custom field values on write", async () => {
    await runInContext(admin, async () => {
      // Remove any fields left behind by an interrupted run.
      const stale = (await adminConfigService.listCustomFields(admin, "task")).filter((entry) => entry.key.startsWith("test_field_"));
      for (const entry of stale) await adminConfigService.deleteCustomField(admin, entry.id);

      const field = await adminConfigService.createCustomField(admin, {
        resourceType: "task",
        key: `test_field_${Date.now()}`,
        label: "Test required field",
        type: "TEXT",
        required: true,
      });

      // A required configured field must be supplied on every write.
      await expect(
        taskService.create(admin, {
          title: "Task without required field",
          description: null,
          status: "OPEN",
          priority: "LOW",
          assigneeId: null,
          departmentId: null,
          dueAt: null,
          recordType: null,
          recordId: null,
          customFields: {},
        }),
      ).rejects.toThrow(AppError);

      const valid = await taskService.create(admin, {
        title: "Task with required field",
        description: null,
        status: "OPEN",
        priority: "LOW",
        assigneeId: null,
        departmentId: null,
        dueAt: null,
        recordType: null,
        recordId: null,
        customFields: { [field!.key]: "supplied" },
      });
      expect(valid.id).toBeTruthy();

      await adminConfigService.deleteCustomField(admin, field!.id);
      await db.delete(tasks).where(eq(tasks.id, valid.id));
    });
  });

  it("appends timeline entries through the generic record infrastructure", async () => {
    await runInContext(admin, async () => {
      await recordTimeline({ recordType: "incident", recordId: createdIncidentId, message: "Automated timeline entry" });
      const entries = await db.select().from(timelineEntries).where(eq(timelineEntries.recordId, createdIncidentId));
      expect(entries.some((entry) => entry.message === "Automated timeline entry")).toBe(true);
    });
  });
});
