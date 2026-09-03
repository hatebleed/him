import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { cases, incidents, reportVersions, reports, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { ReportUpsertInput } from "@/lib/validation/records";

import { recordAudit, recordTimeline } from "../audit/audit";
import { assertCan, type RequestContext } from "../context";
import { notificationService } from "../notifications/service";
import { getUserIdsWithPermission } from "../permissions/service";
import { runWorkflows } from "../workflows/engine";
import { readCustomValues, readCustomValuesForRecord, writeCustomValues } from "./custom-fields";
import { combine, multi, orderByDirection, single, type ListParams } from "./pagination";
import { nextReference, REFERENCE_PREFIXES } from "./reference";

const sortColumns = {
  reference: reports.reference,
  title: reports.title,
  status: reports.status,
  createdAt: reports.createdAt,
} as const;

const TRANSITIONS: Record<string, { from: string[]; to: string; permission?: string; label: string }> = {
  SUBMIT: { from: ["DRAFT", "REJECTED"], to: "SUBMITTED", label: "Submit for review" },
  REVIEW: { from: ["SUBMITTED"], to: "UNDER_REVIEW", permission: "reports.review", label: "Begin review" },
  APPROVE: { from: ["SUBMITTED", "UNDER_REVIEW"], to: "APPROVED", permission: "reports.approve", label: "Approve" },
  REJECT: { from: ["SUBMITTED", "UNDER_REVIEW"], to: "REJECTED", permission: "reports.approve", label: "Reject" },
  FINALISE: { from: ["APPROVED"], to: "FINAL", permission: "reports.approve", label: "Mark as final" },
  ARCHIVE: { from: ["FINAL", "APPROVED"], to: "ARCHIVED", permission: "reports.approve", label: "Archive" },
  REOPEN: { from: ["REJECTED", "ARCHIVED"], to: "DRAFT", label: "Reopen as draft" },
};

export const reportService = {
  async list(ctx: RequestContext, params: ListParams) {
    assertCan(ctx, "reports.view");
    const conditions: SQL[] = [isNull(reports.deletedAt)];

    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(ilike(reports.reference, term), ilike(reports.title, term), ilike(reports.body, term));
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(reports.status, statuses));
    const author = single(params.filters.author);
    if (author) conditions.push(eq(reports.authorId, author));
    const incident = single(params.filters.incident);
    if (incident) conditions.push(eq(reports.incidentId, incident));

    const where = combine(...conditions);
    const sortColumn = sortColumns[(params.sort ?? "createdAt") as keyof typeof sortColumns] ?? reports.createdAt;

    const rows = await db
      .select({
        id: reports.id,
        reference: reports.reference,
        title: reports.title,
        status: reports.status,
        currentVersion: reports.currentVersion,
        authorId: reports.authorId,
        authorName: users.name,
        incidentId: reports.incidentId,
        incidentReference: incidents.reference,
        caseId: reports.caseId,
        caseReference: cases.reference,
        submittedAt: reports.submittedAt,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.authorId))
      .leftJoin(incidents, eq(incidents.id, reports.incidentId))
      .leftJoin(cases, eq(cases.id, reports.caseId))
      .where(where)
      .orderBy(orderByDirection(sortColumn, params.dir))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(reports).where(where);
    const customValues = await readCustomValues("report", rows.map((row) => row.id));

    return {
      rows: rows.map((row) => ({ ...row, customFields: customValues.get(row.id) ?? {} })),
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "reports.view");
    const [report] = await db
      .select({
        id: reports.id,
        reference: reports.reference,
        title: reports.title,
        body: reports.body,
        status: reports.status,
        currentVersion: reports.currentVersion,
        incidentId: reports.incidentId,
        incidentReference: incidents.reference,
        caseId: reports.caseId,
        caseReference: cases.reference,
        categoryId: reports.categoryId,
        authorId: reports.authorId,
        authorName: users.name,
        reviewerId: reports.reviewerId,
        submittedAt: reports.submittedAt,
        reviewedAt: reports.reviewedAt,
        rejectionReason: reports.rejectionReason,
        formData: reports.formData,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.authorId))
      .leftJoin(incidents, eq(incidents.id, reports.incidentId))
      .leftJoin(cases, eq(cases.id, reports.caseId))
      .where(and(eq(reports.id, id), isNull(reports.deletedAt)))
      .limit(1);

    if (!report) throw AppError.notFound("This report does not exist or has been deleted.");

    const [versions, customFields] = await Promise.all([
      db
        .select({
          id: reportVersions.id,
          version: reportVersions.version,
          title: reportVersions.title,
          body: reportVersions.body,
          changeNote: reportVersions.changeNote,
          createdAt: reportVersions.createdAt,
          createdByName: users.name,
        })
        .from(reportVersions)
        .leftJoin(users, eq(users.id, reportVersions.createdById))
        .where(eq(reportVersions.reportId, id))
        .orderBy(desc(reportVersions.version)),
      readCustomValuesForRecord("report", id),
    ]);

    return { ...report, versions, customFields, availableTransitions: await this.availableTransitions(report.status, ctx) };
  },

  async availableTransitions(status: string, ctx: RequestContext) {
    return Object.entries(TRANSITIONS)
      .filter(([, transition]) => transition.from.includes(status))
      .filter(([, transition]) => !transition.permission || ctx.permissions.has(transition.permission))
      .map(([action, transition]) => ({ action, label: transition.label, to: transition.to }));
  },

  async create(ctx: RequestContext, input: ReportUpsertInput) {
    assertCan(ctx, "reports.create");
    const reference = await nextReference(reports, REFERENCE_PREFIXES.report);
    const status = input.status ?? "DRAFT";

    const [created] = await db
      .insert(reports)
      .values({
        reference,
        title: input.title,
        body: input.body ?? "",
        status,
        currentVersion: 1,
        incidentId: input.incidentId,
        caseId: input.caseId,
        categoryId: input.categoryId,
        authorId: ctx.user.id,
        formData: (input.formData ?? null) as never,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning();

    if (!created) throw AppError.badRequest("The report could not be created.");

    await db.insert(reportVersions).values({
      reportId: created.id,
      version: 1,
      title: created.title,
      body: created.body,
      data: (input.formData ?? null) as never,
      changeNote: "Initial draft",
      createdById: ctx.user.id,
    });

    if (input.customFields) await writeCustomValues("report", created.id, input.customFields);

    await recordAudit({ action: "report.created", resourceType: "report", resourceId: created.id, summary: `Created report ${created.reference}`, newValue: { title: created.title } });
    await recordTimeline({ recordType: "report", recordId: created.id, type: "CREATED", message: `Report created by ${ctx.user.name}` });
    if (created.incidentId) {
      await recordTimeline({ recordType: "incident", recordId: created.incidentId, type: "RELATIONSHIP", message: `Report ${created.reference} created` });
    }

    return created;
  },

  /** Edits always create a new immutable version - history is never lost. */
  async update(ctx: RequestContext, id: string, input: ReportUpsertInput, changeNote?: string | null) {
    assertCan(ctx, "reports.edit");
    const [existing] = await db.select().from(reports).where(and(eq(reports.id, id), isNull(reports.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This report does not exist.");

    if (["FINAL", "ARCHIVED"].includes(existing.status)) {
      throw AppError.conflict("This report is locked. Reopen it before making changes.");
    }

    const nextVersion = existing.currentVersion + 1;
    const [updated] = await db
      .update(reports)
      .set({
        title: input.title,
        body: input.body ?? "",
        incidentId: input.incidentId,
        caseId: input.caseId,
        categoryId: input.categoryId,
        status: input.status ?? existing.status,
        currentVersion: nextVersion,
        formData: (input.formData ?? existing.formData) as never,
        updatedById: ctx.user.id,
      })
      .where(eq(reports.id, id))
      .returning();

    await db.insert(reportVersions).values({
      reportId: id,
      version: nextVersion,
      title: input.title,
      body: input.body ?? "",
      data: (input.formData ?? null) as never,
      changeNote: changeNote ?? "Updated report",
      createdById: ctx.user.id,
    });

    if (input.customFields) await writeCustomValues("report", id, input.customFields);

    await recordAudit({
      action: "report.updated",
      resourceType: "report",
      resourceId: id,
      summary: `Updated report ${existing.reference} to version ${nextVersion}`,
      previousValue: { title: existing.title, version: existing.currentVersion },
      newValue: { title: input.title, version: nextVersion },
    });
    await recordTimeline({ recordType: "report", recordId: id, type: "VERSION", message: `Version ${nextVersion} saved by ${ctx.user.name}` });

    return updated;
  },

  async transition(ctx: RequestContext, id: string, action: keyof typeof TRANSITIONS, reason?: string | null, changeNote?: string | null) {
    const [existing] = await db.select().from(reports).where(and(eq(reports.id, id), isNull(reports.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This report does not exist.");

    const transition = TRANSITIONS[action];
    if (!transition) throw AppError.badRequest("Unknown report action.");
    if (!transition.from.includes(existing.status)) {
      throw AppError.conflict(`A report in "${existing.status}" cannot be transitioned with "${action}".`);
    }
    if (transition.permission && !ctx.permissions.has(transition.permission)) {
      throw AppError.forbidden(`This action requires the "${transition.permission}" permission.`);
    }

    const nextVersion = existing.currentVersion + 1;
    const [updated] = await db
      .update(reports)
      .set({
        status: transition.to,
        submittedAt: action === "SUBMIT" ? new Date() : existing.submittedAt,
        reviewedAt: ["APPROVE", "REJECT", "FINALISE", "ARCHIVE"].includes(action) ? new Date() : existing.reviewedAt,
        reviewerId: transition.permission ? ctx.user.id : existing.reviewerId,
        rejectionReason: action === "REJECT" ? (reason ?? null) : null,
        currentVersion: nextVersion,
        updatedById: ctx.user.id,
      })
      .where(eq(reports.id, id))
      .returning();

    await db.insert(reportVersions).values({
      reportId: id,
      version: nextVersion,
      title: existing.title,
      body: existing.body,
      changeNote: changeNote ?? `Status changed to ${transition.to}`,
      createdById: ctx.user.id,
    });

    await recordAudit({
      action: `report.${action.toLowerCase()}`,
      resourceType: "report",
      resourceId: id,
      summary: `Report ${existing.reference} ${action.toLowerCase()}`,
      previousValue: { status: existing.status },
      newValue: { status: transition.to, reason: reason ?? null },
    });
    await recordTimeline({
      recordType: "report",
      recordId: id,
      type: "STATUS",
      message: reason ? `${transition.label} by ${ctx.user.name} - ${reason}` : `${transition.label} by ${ctx.user.name}`,
    });

    if (action === "SUBMIT") {
      const reviewers = await getUserIdsWithPermission("reports.approve");
      await notificationService.sendToMany(reviewers, {
        type: "REPORT",
        category: "REPORTS",
        title: "Report submitted for review",
        message: `${existing.reference}: ${existing.title}`,
        resourceType: "report",
        resourceId: id,
        priority: "HIGH",
      });
      await runWorkflows({ trigger: "REPORT_SUBMITTED", resourceType: "report", recordId: id, context: { status: transition.to, incidentId: existing.incidentId } });
    }

    if (action === "APPROVE" || action === "REJECT") {
      await notificationService.send({
        userId: existing.authorId,
        type: "REPORT",
        category: "REPORTS",
        title: action === "APPROVE" ? "Report approved" : "Report rejected",
        message: action === "REJECT" ? (reason ?? `${existing.reference} was rejected.`) : `${existing.reference} was approved.`,
        resourceType: "report",
        resourceId: id,
        priority: "HIGH",
      });
    }

    return updated;
  },

  /** Restores a previous version as a new version (history is append-only). */
  async restoreVersion(ctx: RequestContext, id: string, version: number) {
    assertCan(ctx, "reports.edit");
    const [existing] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This report does not exist.");
    const [versionRow] = await db
      .select()
      .from(reportVersions)
      .where(and(eq(reportVersions.reportId, id), eq(reportVersions.version, version)))
      .limit(1);
    if (!versionRow) throw AppError.notFound("This version does not exist.");

    const nextVersion = existing.currentVersion + 1;
    await db
      .update(reports)
      .set({ title: versionRow.title, body: versionRow.body, currentVersion: nextVersion, updatedById: ctx.user.id })
      .where(eq(reports.id, id));
    await db.insert(reportVersions).values({
      reportId: id,
      version: nextVersion,
      title: versionRow.title,
      body: versionRow.body,
      changeNote: `Restored version ${version}`,
      createdById: ctx.user.id,
    });

    await recordAudit({ action: "report.version.restored", resourceType: "report", resourceId: id, summary: `Restored version ${version} as version ${nextVersion}` });
    await recordTimeline({ recordType: "report", recordId: id, type: "VERSION", message: `Restored version ${version}` });
    return { ok: true };
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "reports.delete");
    const [existing] = await db.select().from(reports).where(and(eq(reports.id, id), isNull(reports.deletedAt))).limit(1);
    if (!existing) throw AppError.notFound("This report does not exist.");
    await db.update(reports).set({ deletedAt: new Date(), updatedById: ctx.user.id }).where(eq(reports.id, id));
    await recordAudit({ action: "report.deleted", resourceType: "report", resourceId: id, summary: `Deleted report ${existing.reference}` });
    return { id };
  },
};
