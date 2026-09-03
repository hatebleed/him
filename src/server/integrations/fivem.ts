import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { integrationIdentities, roles, userRoles, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { INTEGRATION_PROVIDER, signIntegrationToken } from "@/lib/integrations/token";
import { generateToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { assertCan, type RequestContext } from "@/server/context";
import { loadUserPermissions } from "@/server/permissions/service";
import { configuration } from "@/server/configuration/service";

/**
 * FiveM integration.
 *
 * The game server proves itself with a shared secret and receives a short-lived
 * token that acts as one linked user. Everything the player can then do goes
 * through the normal services, so an in-game operator has exactly the
 * permissions of the account they are linked to - and no more.
 */

/** 403 with a code the game server can react to. */
const deny = (code: string, message: string) => new AppError({ code, message, status: 403 });

export const handshakeSchema = z.object({
  citizenId: z.string().trim().min(1).max(64),
  characterName: z.string().trim().max(120).optional(),
  job: z.string().trim().max(64).optional(),
  grade: z.coerce.number().int().min(0).max(20).optional(),
  callsign: z.string().trim().max(32).optional(),
  serverId: z.coerce.number().int().min(0).max(65535).optional(),
  resource: z.string().trim().max(64).optional(),
});

export type HandshakeInput = z.infer<typeof handshakeSchema>;

/** Parses a JSON object, returning the fallback when it is malformed. */
function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Job -> role key mapping: administrator setting wins, environment is the default. */
async function jobRoleMap(): Promise<Record<string, string>> {
  const fromSettings = await configuration.getSetting<Record<string, string> | null>("fivem.jobRoles", null);
  if (fromSettings && typeof fromSettings === "object") return fromSettings;
  return parseJson<Record<string, string>>(env.FIVEM_JOB_ROLES, {});
}

/** Job -> department id mapping (optional). */
async function jobDepartmentMap(): Promise<Record<string, string>> {
  const fromSettings = await configuration.getSetting<Record<string, string> | null>("fivem.departmentByJob", null);
  if (fromSettings && typeof fromSettings === "object") return fromSettings;
  return {};
}

/** `ABC12345` -> `abc12345`; usernames and emails must be stable and unique. */
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || Math.random().toString(36).slice(2, 10);
}

export const fivemIntegration = {
  /**
   * Exchanges a citizen id for a player token.
   *
   * Called by the game server (never by a game client), so the shared secret
   * stays on the server. Unknown identities are rejected unless an
   * administrator has enabled provisioning.
   */
  async handshake(input: HandshakeInput) {
    const [identity] = await db
      .select({
        id: integrationIdentities.id,
        userId: integrationIdentities.userId,
        displayName: integrationIdentities.displayName,
      })
      .from(integrationIdentities)
      .where(and(eq(integrationIdentities.provider, INTEGRATION_PROVIDER), eq(integrationIdentities.externalId, input.citizenId)))
      .limit(1);

    let userId = identity?.userId ?? null;
    let provisioned = false;

    if (!userId) {
      if (!env.FIVEM_AUTO_PROVISION) {
        throw deny(
          "IDENTITY_NOT_LINKED",
          "This character is not linked to an account. An administrator must link it (POST /api/integrations/fivem/identities) or enable FIVEM_AUTO_PROVISION.",
        );
      }
      const roleKey = (await jobRoleMap())[input.job ?? ""];
      if (!roleKey) {
        throw deny(
          "JOB_NOT_MAPPED",
          `No role is mapped to the job "${input.job ?? "unknown"}". Add it to the fivem.jobRoles setting or FIVEM_JOB_ROLES.`,
        );
      }
      const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, roleKey)).limit(1);
      if (!role) throw AppError.badRequest(`The role "${roleKey}" does not exist.`);

      userId = await db.transaction(async (tx) => {
        const suffix = slug(input.citizenId);
        const [created] = await tx
          .insert(users)
          .values({
            name: input.characterName?.trim() || `Officer ${input.callsign ?? suffix}`,
            email: `fivem.${suffix}@players.invalid`,
            username: `fivem.${suffix}`,
            // A random, unguessable password: in-game operators arrive through
            // this integration, not through the sign-in form.
            passwordHash: await hashPassword(generateToken(24)),
            jobTitle: input.job ? `${input.job}` : null,
            badgeNumber: input.callsign ?? null,
            departmentId: (await jobDepartmentMap())[input.job ?? ""] ?? null,
            status: "ACTIVE",
          })
          .returning({ id: users.id });
        const newUserId = created!.id;
        await tx.insert(userRoles).values({ userId: newUserId, roleId: role.id }).onConflictDoNothing();
        await tx.insert(integrationIdentities).values({
          provider: INTEGRATION_PROVIDER,
          externalId: input.citizenId,
          userId: newUserId,
          displayName: input.characterName ?? null,
        });
        return newUserId;
      });
      provisioned = true;
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        jobTitle: users.jobTitle,
        badgeNumber: users.badgeNumber,
        departmentId: users.departmentId,
        status: users.status,
        lockedUntil: users.lockedUntil,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw AppError.notFound("The linked account no longer exists.");
    if (user.status !== "ACTIVE") throw deny("ACCOUNT_INACTIVE", "The linked account is not active.");
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) throw deny("ACCOUNT_LOCKED", "The linked account is locked.");

    // Record what the character looked like at hand-off; audit value only.
    await db
      .update(integrationIdentities)
      .set({
        lastSeenAt: new Date(),
        displayName: input.characterName ?? undefined,
        metadata: JSON.stringify({
          job: input.job ?? null,
          grade: input.grade ?? null,
          callsign: input.callsign ?? null,
          characterName: input.characterName ?? null,
          serverId: input.serverId ?? null,
          resource: input.resource ?? null,
          seenAt: new Date().toISOString(),
        }),
      })
      .where(and(eq(integrationIdentities.provider, INTEGRATION_PROVIDER), eq(integrationIdentities.externalId, input.citizenId)));

    const { permissions, roles: roleKeys } = await loadUserPermissions(user.id);
    const character = {
      citizenId: input.citizenId,
      job: input.job ?? null,
      grade: input.grade ?? null,
      callsign: input.callsign ?? null,
      name: input.characterName ?? null,
    };
    const { token, expiresAt } = signIntegrationToken({ sub: user.id, character });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      operator: {
        id: user.id,
        name: user.name,
        username: user.username,
        jobTitle: user.jobTitle,
        badgeNumber: user.badgeNumber,
      },
      permissions: [...permissions],
      roles: roleKeys,
      character,
      provisioned,
      ui: { path: "/nui" },
    };
  },

  /** Linked characters (administration). */
  async listIdentities(ctx: RequestContext) {
    assertCan(ctx, "admin.users.manage");
    return db
      .select({
        id: integrationIdentities.id,
        provider: integrationIdentities.provider,
        externalId: integrationIdentities.externalId,
        displayName: integrationIdentities.displayName,
        metadata: integrationIdentities.metadata,
        lastSeenAt: integrationIdentities.lastSeenAt,
        userId: integrationIdentities.userId,
        userName: users.name,
        userStatus: users.status,
      })
      .from(integrationIdentities)
      .innerJoin(users, eq(users.id, integrationIdentities.userId))
      .orderBy(asc(integrationIdentities.externalId))
      .limit(500);
  },

  /** Links a character to an account (administration). */
  async linkIdentity(ctx: RequestContext, input: { citizenId: string; userId: string; displayName?: string | null }) {
    assertCan(ctx, "admin.users.manage");
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
      .limit(1);
    if (!user) throw AppError.notFound("That user was not found.");

    const [existing] = await db
      .select({ id: integrationIdentities.id })
      .from(integrationIdentities)
      .where(and(eq(integrationIdentities.provider, INTEGRATION_PROVIDER), eq(integrationIdentities.externalId, input.citizenId)))
      .limit(1);
    if (existing) throw AppError.conflict("That character is already linked to an account.");

    const [created] = await db
      .insert(integrationIdentities)
      .values({
        provider: INTEGRATION_PROVIDER,
        externalId: input.citizenId,
        userId: input.userId,
        displayName: input.displayName ?? null,
      })
      .returning();
    return created!;
  },

  /** Removes a link (administration). */
  async unlinkIdentity(ctx: RequestContext, id: string) {
    assertCan(ctx, "admin.users.manage");
    const deleted = await db.delete(integrationIdentities).where(eq(integrationIdentities.id, id)).returning({ id: integrationIdentities.id });
    if (deleted.length === 0) throw AppError.notFound("That link was not found.");
    return { id };
  },
};
