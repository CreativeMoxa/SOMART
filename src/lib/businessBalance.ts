import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { Employee } from "@/models/Employee";
import { verifyPassword } from "@/lib/password";

// Business Balance is the most sensitive area. Access requires BOTH:
//   1. authorization — the CEO has given this employee a custom Balance PIN in
//      the Employees module (having a PIN set = authorized), and
//   2. entering that PIN, which grants a short-lived unlock so they aren't
//      asked on every action.
const BB_COOKIE = "somart_bb_unlock";
const UNLOCK_MINUTES = 20;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

// Authorized when the employee has a custom Balance PIN set. The env
// break-glass admin (no employee record) is always allowed so the owner can
// never be locked out.
export async function hasBalanceAccess(user: CurrentUser | null): Promise<boolean> {
  if (!user) return false;
  if (user.isEnvAdmin) return true;
  const emp = await Employee.findById(user.id).select("balancePinHash").lean();
  return Boolean(emp?.balancePinHash);
}

// Verify the entered PIN. A real employee uses their own custom Balance PIN.
// The break-glass owner (env admin, no employee record) can use the custom PIN
// set on the Founder & CEO employee row, and ADMIN_PASSWORD always works as a
// fallback so the owner can never be locked out.
export async function verifyPin(pin: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !pin) return false;
  if (user.isEnvAdmin) {
    const founder = await Employee.findOne({ role: "founder-ceo" }).select("balancePinHash").lean();
    if (founder?.balancePinHash && (await verifyPassword(pin, founder.balancePinHash))) return true;
    return Boolean(process.env.ADMIN_PASSWORD) && pin === process.env.ADMIN_PASSWORD;
  }
  const emp = await Employee.findById(user.id).select("balancePinHash").lean();
  if (!emp?.balancePinHash) return false;
  return verifyPassword(pin, emp.balancePinHash);
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

// True only when an authorized user has a valid, matching unlock token.
export async function isUnlocked(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !(await hasBalanceAccess(user))) return false;
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
