import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import { Employee, canSignIn, type EmployeeDoc } from "@/models/Employee";
import { canAccess, isRole, type ModuleKey, type Role } from "@/lib/roles";

export const SESSION_COOKIE = "somart_session";
const REMEMBER_DAYS = 30;
const SESSION_HOURS = 12;

// Break-glass account from .env.local so the owner can never be locked out.
const ENV_ADMIN_ID = "env-admin";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set in .env.local");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string; // employee id, or "env-admin"
  role: Role;
  sid: string; // session id — used for single-device enforcement
  sv: number; // session version — bumping it revokes every token
};

/** The signed-in person, resolved and re-validated against the database. */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isEnvAdmin: boolean;
};

export async function createSession(
  payload: { sub: string; role: Role; sid: string; sv: number },
  remember: boolean
) {
  const maxAge = remember ? REMEMBER_DAYS * 24 * 60 * 60 : SESSION_HOURS * 60 * 60;
  const token = await new SignJWT({ role: payload.role, sid: payload.sid, sv: payload.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Verify the cookie only (no database work). */
export async function readSession(): Promise<SessionPayload | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecret());

    // Legacy cookie from the previous single-admin login — treat as the
    // break-glass CEO so existing sessions are not dropped on deploy.
    if (payload.role === "admin") {
      return { sub: ENV_ADMIN_ID, role: "founder-ceo", sid: "legacy", sv: 0 };
    }
    if (!isRole(payload.role) || typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role,
      sid: typeof payload.sid === "string" ? payload.sid : "",
      sv: typeof payload.sv === "number" ? payload.sv : 0,
    };
  } catch {
    return null;
  }
}

/**
 * The signed-in employee, re-checked against the database on every call so a
 * suspended/deactivated/deleted employee loses access immediately, and so a
 * single-device employee is signed out when they log in elsewhere.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  if (session.sub === ENV_ADMIN_ID) {
    return {
      id: ENV_ADMIN_ID,
      name: process.env.ADMIN_USERNAME || "Owner",
      email: "",
      role: "founder-ceo",
      isEnvAdmin: true,
    };
  }

  try {
    await connectDB();
    const employee = await Employee.findById(session.sub).lean<EmployeeDoc>();
    if (!employee) return null; // deleted → access revoked
    if (!canSignIn(employee)) return null; // suspended/inactive → revoked
    if ((employee.sessionVersion ?? 0) !== session.sv) return null; // globally revoked
    // Single-device: only the newest session survives.
    if (!employee.allowMultipleDevices && employee.currentSessionId !== session.sid) {
      return null;
    }
    return {
      id: String(employee._id),
      name: employee.name,
      email: employee.email,
      role: employee.role as Role,
      isEnvAdmin: false,
    };
  } catch (err) {
    console.error("getCurrentUser failed:", err);
    return null;
  }
}

/** Backwards-compatible guard used by the existing API routes. */
export async function isAdmin(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

/** Guard for a specific module. Returns the user, or null when not allowed. */
export async function requireModule(moduleKey: ModuleKey): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return canAccess(user.role, moduleKey) ? user : null;
}

export function newSessionId() {
  return randomUUID();
}

/** Best-effort request metadata for the activity log. */
export async function requestContext() {
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
    return { ip, device: h.get("user-agent") ?? "" };
  } catch {
    return { ip: "", device: "" };
  }
}

export function checkEnvCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  return username.trim().toLowerCase() === u.toLowerCase() && password === p;
}
