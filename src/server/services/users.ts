import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { departments, roles, sessions, userRoles, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth/password";
import { generateToken } from "@/lib/auth/tokens";
import { revokeAllSessions } from "@/lib/auth/session";
import { recordAudit } from "@/server/audit/audit";
import { assertCan, type RequestContext } from "@/server/context";
import { logger } from "@/lib/logger";

import { combine, multi, orderByDirection, single, type ListParams } from "./pagination";

export const userService = {
  async list(ctx: RequestContext, params: ListParams) {
    assertCan(ctx, "admin.users.manage");
    const conditions: SQL[] = [];
    if (params.search) {
      const term = `%${params.search}%`;
      const search = or(ilike(users.name, term), ilike(users.email, term), ilike(users.username, term), ilike(users.badgeNumber, term));
      if (search) conditions.push(search);
    }
    const statuses = multi(params.filters.status);
    if (statuses.length) conditions.push(inArray(users.status, statuses as never[]));
    const department = single(params.filters.department);
    if (department) conditions.push(eq(users.departmentId, department));
    const where = combine(...conditions);

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        jobTitle: users.jobTitle,
        badgeNumber: users.badgeNumber,
        status: users.status,
        departmentId: users.departmentId,
        departmentName: departments.name,
        lastLoginAt: users.lastLoginAt,
        mfaEnabled: users.mfaEnabled,
        createdAt: users.createdAt,
        lockedUntil: users.lockedUntil,
      })
      .from(users)
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(where)
      .orderBy(orderByDirection(users.name, "asc"))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize);

    const [totalRow] = await db.select({ value: count() }).from(users).where(where);
    const ids = rows.map((row) => row.id);
    const roleRows = ids.length
      ? await db
          .select({ userId: userRoles.userId, key: roles.key, name: roles.name })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .where(inArray(userRoles.userId, ids))
      : [];

    return {
      rows: rows.map((row) => ({
        ...row,
        roles: roleRows.filter((role) => role.userId === row.id).map(({ userId: _userId, ...role }) => role),
      })),
      total: Number(totalRow?.value ?? 0),
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / params.pageSize)),
    };
  },

  async get(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.users.manage");
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        jobTitle: users.jobTitle,
        badgeNumber: users.badgeNumber,
        phone: users.phone,
        status: users.status,
        departmentId: users.departmentId,
        departmentName: departments.name,
        mfaEnabled: users.mfaEnabled,
        mustChangePassword: users.mustChangePassword,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        lockedUntil: users.lockedUntil,
        failedLogins: users.failedLogins,
      })
      .from(users)
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw AppError.notFound("This user does not exist.");

    const [roleRows, sessionRows] = await Promise.all([
      db
        .select({ id: roles.id, key: roles.key, name: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(eq(userRoles.userId, id)),
      db
        .select({
          id: sessions.id,
          createdAt: sessions.createdAt,
          lastUsedAt: sessions.lastUsedAt,
          ip: sessions.ip,
          userAgent: sessions.userAgent,
          expiresAt: sessions.expiresAt,
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .where(eq(sessions.userId, id))
        .orderBy(desc(sessions.lastUsedAt))
        .limit(20),
    ]);

    return { ...user, roles: roleRows, sessions: sessionRows };
  },

  async create(
    ctx: RequestContext,
    input: {
      name: string;
      email: string;
      username: string;
      password?: string;
      jobTitle?: string | null;
      badgeNumber?: string | null;
      phone?: string | null;
      status?: "ACTIVE" | "INVITED" | "SUSPENDED" | "DEACTIVATED";
      departmentId?: string | null;
      roleIds: string[];
    },
  ) {
    assertCan(ctx, "admin.users.manage");
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username))!)
      .limit(1);
    if (existing) throw AppError.conflict("A user with that email or username already exists.");

    const password = input.password ?? generateToken(12);
    const policy = validatePasswordPolicy(password);
    if (!policy.valid && input.password) {
      throw AppError.badRequest(`Password does not meet the policy: ${policy.issues.join(" ")}`);
    }

    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        name: input.name,
        email,
        username,
        passwordHash,
        jobTitle: input.jobTitle ?? null,
        badgeNumber: input.badgeNumber ?? null,
        phone: input.phone ?? null,
        status: input.status ?? "ACTIVE",
        departmentId: input.departmentId ?? null,
        mustChangePassword: !input.password,
        passwordUpdatedAt: new Date(),
      })
      .returning();

    if (input.roleIds.length) {
      await db.insert(userRoles).values(input.roleIds.map((roleId) => ({ userId: created!.id, roleId }))).onConflictDoNothing();
    }

    await recordAudit({
      action: "user.created",
      resourceType: "user",
      resourceId: created!.id,
      summary: `Created user ${created!.username}`,
      newValue: { email, username: created!.username, roles: input.roleIds },
    });
    logger.info("User created", { userId: created!.id, by: ctx.user.id });
    return { user: created, temporaryPassword: input.password ? null : password };
  },

  async update(
    ctx: RequestContext,
    id: string,
    input: { name?: string; email?: string; username?: string; jobTitle?: string | null; badgeNumber?: string | null; phone?: string | null; departmentId?: string | null; status?: "ACTIVE" | "INVITED" | "SUSPENDED" | "DEACTIVATED"; roleIds?: string[] },
  ) {
    assertCan(ctx, "admin.users.manage");
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This user does not exist.");

    if (existing.id === ctx.user.id && input.status && input.status !== "ACTIVE") {
      throw AppError.badRequest("You cannot deactivate your own account.");
    }

    const [updated] = await db
      .update(users)
      .set({
        name: input.name ?? existing.name,
        email: input.email?.trim().toLowerCase() ?? existing.email,
        username: input.username?.trim().toLowerCase() ?? existing.username,
        jobTitle: input.jobTitle ?? existing.jobTitle,
        badgeNumber: input.badgeNumber ?? existing.badgeNumber,
        phone: input.phone ?? existing.phone,
        departmentId: input.departmentId ?? existing.departmentId,
        status: input.status ?? existing.status,
        lockedUntil: input.status === "ACTIVE" ? null : existing.lockedUntil,
      })
      .where(eq(users.id, id))
      .returning();

    if (input.roleIds) {
      await db.delete(userRoles).where(eq(userRoles.userId, id));
      if (input.roleIds.length) {
        await db.insert(userRoles).values(input.roleIds.map((roleId) => ({ userId: id, roleId }))).onConflictDoNothing();
      }
    }

    // A suspended or deactivated account must not keep live sessions.
    if (input.status && input.status !== "ACTIVE") {
      await revokeAllSessions(id);
    }

    await recordAudit({
      action: "user.updated",
      resourceType: "user",
      resourceId: id,
      summary: `Updated user ${existing.username}`,
      previousValue: { status: existing.status, email: existing.email },
      newValue: { status: input.status ?? existing.status, email: updated!.email, roles: input.roleIds ?? null },
    });
    return updated;
  },

  async resetPassword(ctx: RequestContext, id: string, newPassword?: string) {
    assertCan(ctx, "admin.users.manage");
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This user does not exist.");

    const password = newPassword ?? generateToken(12);
    if (newPassword) {
      const policy = validatePasswordPolicy(newPassword);
      if (!policy.valid) throw AppError.badRequest(`Password does not meet the policy: ${policy.issues.join(" ")}`);
    }

    const passwordHash = await hashPassword(password);
    await db
      .update(users)
      .set({ passwordHash, passwordUpdatedAt: new Date(), mustChangePassword: true, failedLogins: 0, lockedUntil: null })
      .where(eq(users.id, id));
    await revokeAllSessions(id);

    await recordAudit({ action: "user.password.reset", resourceType: "user", resourceId: id, summary: `Reset password for ${existing.username}` });
    return { temporaryPassword: newPassword ? null : password };
  },

  async setStatus(ctx: RequestContext, id: string, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") {
    return this.update(ctx, id, { status });
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.users.manage");
    if (id === ctx.user.id) throw AppError.badRequest("You cannot delete your own account.");
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This user does not exist.");
    await db.update(users).set({ deletedAt: new Date(), status: "DEACTIVATED" }).where(eq(users.id, id));
    await revokeAllSessions(id);
    await recordAudit({ action: "user.deleted", resourceType: "user", resourceId: id, summary: `Deleted user ${existing.username}` });
    return { id };
  },

  async revokeSessions(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.users.manage");
    await revokeAllSessions(id);
    await recordAudit({ action: "user.sessions.revoked", resourceType: "user", resourceId: id, summary: "Revoked all sessions" });
    return { ok: true };
  },

  /** Directory used by pickers (assignees, unit members, mentions). */
  async directory(ctx: RequestContext) {
    assertCan(ctx, "people.view");
    return db
      .select({ id: users.id, name: users.name, jobTitle: users.jobTitle, departmentId: users.departmentId })
      .from(users)
      .where(and(eq(users.status, "ACTIVE"), isNull(users.deletedAt)))
      .orderBy(users.name)
      .limit(200);
  },
};
