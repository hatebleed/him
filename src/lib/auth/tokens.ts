import { createHash, randomBytes } from "node:crypto";

/** High-entropy URL-safe token (used for sessions and password resets). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Tokens are stored hashed: a leaked database dump must not allow session
 * replay. The token itself is high entropy, so a plain digest is sufficient.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
