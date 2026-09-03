import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Password hashing with scrypt (memory-hard, no native build step).
 * Format: `scrypt$<iterations>$<saltHex>$<hashHex>` so parameters can be
 * raised later and existing hashes transparently re-hashed on next login.
 */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, , , , saltHex, hashHex] = parts as [string, string, string, string, string, string];
  try {
    const expected = Buffer.from(hashHex, "hex");
    const derived = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
    return timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

/** Password strength policy - deliberately explicit rather than a magic regex. */
export function validatePasswordPolicy(password: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (password.length < 12) issues.push("Use at least 12 characters.");
  if (!/[a-z]/.test(password)) issues.push("Include a lowercase letter.");
  if (!/[A-Z]/.test(password)) issues.push("Include an uppercase letter.");
  if (!/[0-9]/.test(password)) issues.push("Include a number.");
  return { valid: issues.length === 0, issues };
}
