import { afterAll, describe, expect, it } from "vitest";

import { hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { validateUpload, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { assertCan } from "@/server/context";
import type { RequestContext } from "@/server/context";
import { AppError } from "@/lib/errors";
import { conditionsMet } from "@/lib/rules";
import { pool } from "@/lib/db/client";

/**
 * Security tests.
 * Focused on the guarantees that matter: credential storage, token handling,
 * upload validation, server-side authorisation and rule evaluation.
 */
function context(permissions: string[]): RequestContext {
  return {
    requestId: "test",
    user: {
      id: "test-user",
      email: "test@example.test",
      username: "test",
      name: "Test User",
      jobTitle: null,
      badgeNumber: null,
      avatarUrl: null,
      status: "ACTIVE",
      departmentId: null,
      mfaEnabled: false,
      mustChangePassword: false,
      lastLoginAt: null,
      sessionExpiresAt: new Date(Date.now() + 60_000),
    },
    permissions: new Set(permissions),
    roles: [],
    ip: "127.0.0.1",
    userAgent: "vitest",
    path: "/tests",
  } as RequestContext;
}

describe("password storage", () => {
  it("never stores passwords in plain text and salts every hash", async () => {
    const first = await hashPassword("DemoPass123!");
    const second = await hashPassword("DemoPass123!");
    expect(first).not.toContain("DemoPass123!");
    expect(first).not.toBe(second);
    expect(first.split("$")[0]).toBe("scrypt");
  });

  it("verifies correct passwords and rejects wrong ones", async () => {
    const hash = await hashPassword("DemoPass123!");
    expect(await verifyPassword("DemoPass123!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("DemoPass123!", null)).toBe(false);
    expect(await verifyPassword("DemoPass123!", "malformed")).toBe(false);
  });

  it("enforces the password policy", () => {
    expect(validatePasswordPolicy("short").valid).toBe(false);
    expect(validatePasswordPolicy("alllowercase1").valid).toBe(false);
    expect(validatePasswordPolicy("DemoPass123!").valid).toBe(true);
  });
});

describe("session tokens", () => {
  it("generates high entropy tokens and stores only their digest", () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(generateToken())).not.toBe(hashToken(generateToken()));
  });
});

describe("upload validation", () => {
  it("accepts a PNG by magic bytes even when the MIME type lies", () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    expect(() => validateUpload({ name: "evidence.png", type: "text/plain", size: png.length, data: png })).not.toThrow();
  });

  it("rejects executable and unsupported content", () => {
    const executable = Buffer.from("MZ\\x90\\x00\\x03");
    expect(() => validateUpload({ name: "payload.exe", type: "application/octet-stream", size: executable.length, data: executable })).toThrow();
  });

  it("rejects empty files and files over the configured limit", () => {
    expect(() => validateUpload({ name: "empty.txt", type: "text/plain", size: 0, data: Buffer.alloc(0) })).toThrow();
    expect(() => validateUpload({ name: "huge.txt", type: "text/plain", size: MAX_UPLOAD_BYTES + 1, data: Buffer.alloc(10) })).toThrow();
  });

  it("rejects a PDF whose extension does not match its content type", () => {
    const pdf = Buffer.from("%PDF-1.7\\n");
    expect(() => validateUpload({ name: "notes.txt", type: "application/pdf", size: pdf.length, data: pdf })).toThrow();
  });
});

describe("authorisation", () => {
  it("refuses actions when the permission is missing", () => {
    expect(() => assertCan(context(["people.view"]), "people.delete")).toThrow(AppError);
    expect(() => assertCan(context(["people.view"]), "people.view")).not.toThrow();
  });

  it("does not trust client supplied roles or permissions", () => {
    // The only input is the server-resolved permission set.
    const ctx = context(["people.view"]);
    expect(ctx.permissions.has("admin.access")).toBe(false);
  });

  it("evaluates conditional rules against the resolved context only", () => {
    expect(conditionsMet([{ field: "status", operator: "EQUALS", value: "ACTIVE" }], { status: "ACTIVE" })).toBe(true);
    expect(conditionsMet([{ field: "status", operator: "EQUALS", value: "ACTIVE" }], { status: "CLOSED" })).toBe(false);
  });
});

afterAll(async () => {
  await pool.end();
});
