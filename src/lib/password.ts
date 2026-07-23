import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

// scrypt is a memory-hard KDF built into Node — no extra dependency needed.
// (Only used from Node-runtime API routes, never from edge middleware.)
const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  try {
    const key = await scrypt(password, salt, KEY_LENGTH);
    const expected = Buffer.from(hex, "hex");
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// Returns an error message, or null when the password is acceptable.
export function passwordProblem(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}
