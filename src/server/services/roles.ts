import "server-only";

import { asc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { departments, permissions, rolePermissions, roles, userRoles } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit/audit";
import { assertCan, type RequestContext } from "@/server/context";
import { PERMISSION_CATALOGUE } from "@/config/permissions";

import { getRolePermissions, setRolePermissions } from "../permissions/service";

/**
 * Roles, permissions and departments are configuration, not code: the seeded
 * roles are fully editable and new roles can be created at runtime.
 */
export const roleService = {
  async list(ctx: RequestContext) {
    assertCan(ctx, "admin.roles.manage");
    const roleRows = await db.select().from(roles).orderBy(asc(roles.sortOrder), asc(roles.name));
    const ids = roleRows.map((row) => row.id);

    const [permissionRows, memberRows] = await Promise.all([
      ids.length
        ? db
            .select({ roleId: rolePermissions.roleId, key: permissions.key })
            .from(rolePermissions)
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(inArray(rolePermissions.roleId, ids))
        : [],
      ids.length
        ? db
            .select({ roleId: userRoles.roleId, count: userRoles.userId })
            .from(userRoles)
            .where(inArray(userRoles.roleId, ids))
        : [],
    ]);

    const counts = new Map<string, number>();
    for (const row of memberRows) counts.set(row.roleId, (counts.get(row.roleId) ?? 0) + 1);

    return roleRows.map((role) => ({
      ...role,
      permissions: permissionRows.filter((row) => row.roleId === role.id).map((row) => row.key),
      memberCount: counts.get(role.id) ?? 0,
    }));
  },

  async permissionsCatalogue(ctx: RequestContext) {
    assertCan(ctx, "admin.roles.manage");
    const rows = await db.select().from(permissions).orderBy(asc(permissions.category), asc(permissions.key));
    return { catalogue: PERMISSION_CATALOGUE, stored: rows };
  },

  async create(ctx: RequestContext, input: { key: string; name: string; description?: string | null; permissionKeys?: string[] }) {
    assertCan(ctx, "admin.roles.manage");
    const key = input.key.trim().toLowerCase();
    const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key)).limit(1);
    if (existing) throw AppError.conflict("A role with that key already exists.");

    const [created] = await db
      .insert(roles)
      .values({ key, name: input.name, description: input.description ?? null })
      .returning();

    if (input.permissionKeys?.length) {
      await setRolePermissions(created!.id, input.permissionKeys);
    }

    await recordAudit({
      action: "role.created",
      resourceType: "role",
      resourceId: created!.id,
      summary: `Created role ${created!.name}`,
      newValue: { permissions: input.permissionKeys ?? [] },
    });
    return created;
  },

  async update(ctx: RequestContext, id: string, input: { name?: string; description?: string | null; permissionKeys?: string[] }) {
    assertCan(ctx, "admin.roles.manage");
    const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This role does not exist.");

    const before = await getRolePermissions(id);

    const [updated] = await db
      .update(roles)
      .set({ name: input.name ?? existing.name, description: input.description ?? existing.description })
      .where(eq(roles.id, id))
      .returning();

    if (input.permissionKeys) {
      await setRolePermissions(id, input.permissionKeys);
    }

    await recordAudit({
      action: "role.updated",
      resourceType: "role",
      resourceId: id,
      summary: `Updated role ${existing.name}`,
      previousValue: { permissions: before },
      newValue: { permissions: input.permissionKeys ?? before },
    });
    return updated;
  },

  /**
   * Guards against privilege escalation: the last remaining role that holds
   * `admin.roles.manage` cannot be stripped of it.
   */
  async assertNotRemovingLastAdminRole(roleId: string, nextPermissions: string[]): Promise<void> {
    const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!role) return;
    const hadAdmin = (await getRolePermissions(roleId)).includes("admin.roles.manage");
    if (!hadAdmin || nextPermissions.includes("admin.roles.manage")) return;

    const adminRoles = await db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(permissions.key, "admin.roles.manage"));
    const unique = new Set(adminRoles.map((row) => row.roleId));
    if (unique.size <= 1 && unique.has(roleId)) {
      throw AppError.conflict("At least one role must keep the ability to manage roles.");
    }
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.roles.manage");
    const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This role does not exist.");
    if (existing.isSystem) throw AppError.conflict("System roles cannot be deleted. Edit them instead.");

    const [members] = await db.select({ count: userRoles.userId }).from(userRoles).where(eq(userRoles.roleId, id)).limit(1);
    if (members) throw AppError.conflict("Remove all users from this role before deleting it.");

    await db.delete(roles).where(eq(roles.id, id));
    await recordAudit({ action: "role.deleted", resourceType: "role", resourceId: id, summary: `Deleted role ${existing.name}` });
    return { id };
  },

  /** All roles, for pickers (no admin permission required beyond being signed in). */
  async options(ctx: RequestContext) {
    assertCan(ctx, "admin.access");
    return db.select({ id: roles.id, key: roles.key, name: roles.name }).from(roles).orderBy(asc(roles.name));
  },
};

export const departmentService = {
  async list(ctx: RequestContext) {
    assertCan(ctx, "admin.departments.manage");
    return db.select().from(departments).orderBy(asc(departments.name));
  },

  async options() {
    return db.select({ id: departments.id, name: departments.name, code: departments.code }).from(departments).orderBy(asc(departments.name));
  },

  async create(ctx: RequestContext, input: { name: string; code: string; description?: string | null; parentId?: string | null }) {
    assertCan(ctx, "admin.departments.manage");
    const [existing] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.code, input.code.trim().toUpperCase()))
      .limit(1);
    if (existing) throw AppError.conflict("A department with that code already exists.");

    const [created] = await db
      .insert(departments)
      .values({
        name: input.name,
        code: input.code.trim().toUpperCase(),
        description: input.description ?? null,
        parentId: input.parentId ?? null,
      })
      .returning();

    await recordAudit({ action: "department.created", resourceType: "department", resourceId: created!.id, summary: `Created department ${created!.name}` });
    return created;
  },

  async update(ctx: RequestContext, id: string, input: { name?: string; code?: string; description?: string | null; active?: boolean; parentId?: string | null }) {
    assertCan(ctx, "admin.departments.manage");
    const [existing] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This department does not exist.");
    if (input.parentId === id) throw AppError.badRequest("A department cannot be its own parent.");

    const [updated] = await db
      .update(departments)
      .set({
        name: input.name ?? existing.name,
        code: input.code?.trim().toUpperCase() ?? existing.code,
        description: input.description ?? existing.description,
        active: input.active ?? existing.active,
        parentId: input.parentId ?? existing.parentId,
      })
      .where(eq(departments.id, id))
      .returning();

    await recordAudit({
      action: "department.updated",
      resourceType: "department",
      resourceId: id,
      summary: `Updated department ${existing.name}`,
      previousValue: { name: existing.name, active: existing.active },
      newValue: { name: updated!.name, active: updated!.active },
    });
    return updated;
  },

  async remove(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.departments.manage");
    const [existing] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    if (!existing) throw AppError.notFound("This department does not exist.");
    const childRows = await db.select({ id: departments.id }).from(departments).where(eq(departments.parentId, id)).limit(1);
    if (childRows.length) throw AppError.conflict("Move or delete child departments first.");
    await db.delete(departments).where(eq(departments.id, id));
    await recordAudit({ action: "department.deleted", resourceType: "department", resourceId: id, summary: `Deleted department ${existing.name}` });
    return { id };
  },
};

export { ne };
