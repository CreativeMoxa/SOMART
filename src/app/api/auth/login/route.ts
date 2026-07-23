import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Employee, canSignIn, normalizeEmail } from "@/models/Employee";
import { verifyPassword } from "@/lib/password";
import { rateLimit, resetLimit } from "@/lib/rateLimit";
import { createSession, newSessionId, requestContext } from "@/lib/auth";
import { logActivity } from "@/models/ActivityLog";
import type { Role } from "@/lib/roles";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    const remember = body.remember === true;
    const { ip, device } = await requestContext();

    const limited = rateLimit(`login:${email}:${ip}`, 8, 10 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${limited.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const employee = await Employee.findOne({ email });
    // Deliberately vague so the endpoint can't be used to enumerate accounts.
    const invalid = NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );
    if (!employee) return invalid;

    if (!employee.passwordHash) {
      return NextResponse.json(
        { error: "This account isn't registered yet. Please use Register first." },
        { status: 400 }
      );
    }
    if (!(await verifyPassword(password, employee.passwordHash))) return invalid;
    if (!canSignIn(employee)) {
      return NextResponse.json(
        { error: "This account is suspended or inactive. Please contact your administrator." },
        { status: 403 }
      );
    }

    const sid = newSessionId();
    // Single-device: recording the newest session id invalidates the others,
    // because getCurrentUser() compares the token's sid against this value.
    employee.currentSessionId = sid;
    employee.lastLoginAt = new Date();
    await employee.save();

    await createSession(
      {
        sub: String(employee._id),
        role: employee.role as Role,
        sid,
        sv: employee.sessionVersion ?? 0,
      },
      remember
    );

    resetLimit(`login:${email}:${ip}`);

    await logActivity({
      employeeId: employee._id,
      employeeName: employee.name,
      employeeRole: employee.role as Role,
      action: "signed in",
      module: "employees",
      ip,
      device,
    });

    return NextResponse.json({
      ok: true,
      name: employee.name,
      role: employee.role,
      // Tells the client where to land, since roles differ.
      singleDevice: employee.allowMultipleDevices === false,
    });
  } catch (err) {
    console.error("POST /api/auth/login failed:", err);
    return NextResponse.json({ error: "Sign in failed" }, { status: 500 });
  }
}
