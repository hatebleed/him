import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { permissions, rolePermissions, roles, userRoles } from "@/lib/db/schema";

export type UserPermissionSet = {
  permissions: ReadonlySet<string>;
  roles: string[];
};

/**
 * Loads the effective permission set for a user: the union of the permissions
 * granted by every role assigned to them.
 */
export async function loadUserPermissions(userId: string): Promise<UserPermissionSet> {
  const rows = await db
    .select({ key: permissions.key, roleKey: roles.key })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));

  const set = new Set<string>();
  const roleKeys = new Set<string>();
  for (const row of rows) {
    set.add(row.key);
    roleKeys.add(row.roleKey);
  }
  return { permissions: set, roles: [...roleKeys] };
}

/** Users holding a given permission - used for targeted notifications. */
export async function getUserIdsWithPermission(permissionKey: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(permissions.key, permissionKey));
  return rows.map((row) => row.userId);
}

export async function getRolePermissions(roleId: string): Promise<string[]> {
  const rows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((row) => row.key);
}

export async function setRolePermissions(roleId: string, permissionKeys: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permissionKeys.length === 0) return;
    const permissionRows = await tx.select({ id: permissions.id, key: permissions.key }).from(permissions);
    const byKey = new Map(permissionRows.map((row) => [row.key, row.id] as const));
    const values = permissionKeys
      .map((key) => byKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId, permissionId }));
    if (values.length > 0) await tx.insert(rolePermissions).values(values);
  });
}
