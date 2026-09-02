import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { Employee } from "@/models/Employee";
import { verifyPassword } from "@/lib/password";

// Business Balance is the most sensitive area. Access requires BOTH:
//   1. an authorized role (the owner / Founder & CEO), and
//   2. a PIN — the user's own account password — re-entered to unlock, which
//      grants a short-lived unlock so they aren't asked on every action.
const BB_COOKIE = "somart_bb_unlock";
const UNLOCK_MINUTES = 20;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

// Only the owner may view/edit Business Balance. The env break-glass admin
// resolves to founder-ceo, so the owner is never locked out.
export function canAccessBalance(role: string): boolean {
  return role === "founder-ceo";
}

// Verify the current user's password as the unlock PIN.
export async function verifyPin(password: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !canAccessBalance(user.role)) return false;
  if (!password) return false;
  if (user.isEnvAdmin) {
    return Boolean(process.env.ADMIN_PASSWORD) && password === process.env.ADMIN_PASSWORD;
  }
  const emp = await Employee.findById(user.id).select("passwordHash").lean();
  if (!emp?.passwordHash) return false;
  return verifyPassword(password, emp.passwordHash);
}

export async function setUnlock(userId: string): Promise<void> {
  const token = await new SignJWT({ t: "bb" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${UNLOCK_MINUTES * 60}s`)
    .sign(secret());
  const store = await cookies();
  store.set(BB_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: UNLOCK_MINUTES * 60,
    path: "/",
  });
}

export async function clearUnlock(): Promise<void> {
  const store = await cookies();
  store.delete(BB_COOKIE);
}

// True only when the current owner has a valid, matching unlock token.
export async function isUnlocked(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !canAccessBalance(user.role)) return false;
  try {
    const store = await cookies();
    const token = store.get(BB_COOKIE)?.value;
    if (!token) return false;
    const { payload } = await jwtVerify(token, secret());
    return payload.sub === user.id;
  } catch {
    return false;
  }
}
