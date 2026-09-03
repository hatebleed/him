import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db, pool } from "@/lib/db/client";
import { integrationIdentities, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { signIntegrationToken, verifyIntegrationToken } from "@/lib/integrations/token";
import { fivemIntegration } from "@/server/integrations/fivem";
import { loadUserPermissions } from "@/server/permissions/service";
import type { RequestContext } from "@/server/context";

/**
 * FiveM integration.
 *
 * Exercises the real handshake against the real database: an unknown character
 * gets nothing, a linked character gets a token bound to the account it is
 * linked to, and the token only unlocks what that account may do.
 */
async function contextFor(username: string): Promise<RequestContext> {
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

describe("fivem integration", () => {
  let admin: RequestContext;
  let officer: RequestContext;
  const citizenId = `TEST${Date.now()}`;

  beforeAll(async () => {
    admin = await contextFor("admin");
    officer = await contextFor("officer1");
  });

  afterAll(async () => {
    await db.delete(integrationIdentities).where(eq(integrationIdentities.externalId, citizenId));
    await pool.end();
  });

  it("refuses an unknown character with a code the resource can act on", async () => {
    await expect(
      fivemIntegration.handshake({ citizenId: `NOPE${Date.now()}`, job: "police", characterName: "Nobody" }),
    ).rejects.toMatchObject({ status: 403, code: "IDENTITY_NOT_LINKED" });
  });

  it("links a character through the administrative API", async () => {
    const link = await fivemIntegration.linkIdentity(admin, { citizenId, userId: officer.user.id, displayName: "Test Officer" });
    expect(link.userId).toBe(officer.user.id);
    await expect(fivemIntegration.linkIdentity(admin, { citizenId, userId: officer.user.id })).rejects.toBeInstanceOf(AppError);
  });

  it("exchanges a linked character for a token bound to that account", async () => {
    const result = await fivemIntegration.handshake({ citizenId, job: "police", grade: 2, callsign: "T-1", characterName: "Test Officer" });

    expect(result.operator.id).toBe(officer.user.id);
    expect(result.provisioned).toBe(false);
    expect(new Set(result.permissions)).toEqual(new Set([...officer.permissions]));

    const payload = verifyIntegrationToken(result.token);
    expect(payload?.sub).toBe(officer.user.id);
    expect(payload?.character?.callsign).toBe("T-1");
  });

  it("records the character context at hand-off", async () => {
    const rows = await fivemIntegration.listIdentities(admin);
    const row = rows.find((entry) => entry.externalId === citizenId);
    expect(row).toBeTruthy();
    expect(row?.lastSeenAt).toBeInstanceOf(Date);
    expect(JSON.parse(row?.metadata ?? "{}")).toMatchObject({ job: "police", callsign: "T-1" });
  });

  it("rejects a tampered or expired token", () => {
    const { token } = signIntegrationToken({ sub: officer.user.id, ttlHours: 1 });
    const [prefix, body, signature] = token.split(".");
    expect(verifyIntegrationToken(`${prefix}.${body}.${signature}`)).not.toBeNull();
    expect(verifyIntegrationToken(`${prefix}.${body}.${signature}x`)).toBeNull();
    expect(verifyIntegrationToken("fiv1.not-a-token")).toBeNull();
    expect(verifyIntegrationToken(signIntegrationToken({ sub: officer.user.id, ttlHours: -1 }).token)).toBeNull();
  });

  it("removes a link on request", async () => {
    const rows = await fivemIntegration.listIdentities(admin);
    const row = rows.find((entry) => entry.externalId === citizenId);
    await fivemIntegration.unlinkIdentity(admin, row!.id);
    const after = await fivemIntegration.listIdentities(admin);
    expect(after.find((entry) => entry.externalId === citizenId)).toBeUndefined();
  });
});
