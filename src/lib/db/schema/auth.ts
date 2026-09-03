import { relations } from "drizzle-orm";
import { boolean, index, integer, pgEnum, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

import { createdAt, id, softDelete, updatedAt } from "./shared";

export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INVITED", "SUSPENDED", "DEACTIVATED"]);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    jobTitle: text("job_title"),
    badgeNumber: text("badge_number"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    passwordHash: text("password_hash").notNull(),
    passwordAlgo: text("password_algo").notNull().default("scrypt"),
    passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true, mode: "date" }),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    // MFA-ready architecture: credentials are stored, enrolment is pluggable.
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaSecret: text("mfa_secret"),
    mfaMethod: text("mfa_method"),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: "date" }),
    departmentId: text("department_id"),
    timezone: text("timezone"),
    metadata: text("metadata"),
    deletedAt: softDelete(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_username_unique").on(table.username),
    index("users_status_idx").on(table.status),
    index("users_department_idx").on(table.departmentId),
    index("users_deleted_idx").on(table.deletedAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("sessions_token_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    createdIp: text("created_ip"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("password_reset_token_unique").on(table.tokenHash),
    index("password_reset_user_idx").on(table.userId),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: id(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("roles_key_unique").on(table.key)],
);

export const permissions = pgTable(
  "permissions",
  {
    id: id(),
    key: text("key").notNull(), // resource.action, e.g. people.create
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    category: text("category").notNull().default("General"),
    isSystem: boolean("is_system").notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("permissions_key_unique").on(table.key),
    index("permissions_resource_idx").on(table.resource),
    index("permissions_category_idx").on(table.category),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("role_permission_unique").on(table.roleId, table.permissionId),
    index("role_permission_permission_idx").on(table.permissionId),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("user_role_unique").on(table.userId, table.roleId),
    index("user_role_role_idx").on(table.roleId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  sessions: many(sessions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  users: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type Session = typeof sessions.$inferSelect;
