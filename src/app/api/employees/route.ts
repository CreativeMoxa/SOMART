import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  Employee,
  EMPLOYEE_STATUSES,
  ensureFounderCeo,
  normalizeEmail,
} from "@/models/Employee";
import { requireModule, requestContext } from "@/lib/auth";
import { isRole, ROLE_LABELS } from "@/lib/roles";
import { logActivity } from "@/models/ActivityLog";
import { sendInviteEmail } from "@/lib/email";

// Employees is a Founder & CEO-only module — enforced here as well as in the UI.
export async function GET() {
  const user = await requireModule("employees");
  if (!user) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  try {
    await connectDB();
    // Guarantees the owner's CEO record exists (safe to call repeatedly).
    await ensureFounderCeo();
    const employees = await Employee.find()
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json(employees);
  } catch (err) {
    console.error("GET /api/employees failed:", err);
    return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireModule("employees");
  if (!user) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  try {
    await connectDB();
    const body = await req.json();

    const email = normalizeEmail(body.email);
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }
    if (!isRole(body.role)) {
      return NextResponse.json({ error: "Please choose a valid position" }, { status: 400 });
    }
    if (await Employee.exists({ email })) {
      return NextResponse.json(
        { error: "An employee with this email already exists" },
        { status: 400 }
      );
    }

    const status = EMPLOYEE_STATUSES.includes(body.status) ? body.status : "active";
    const employee = await Employee.create({
      name,
      email,
      phone: String(body.phone ?? "").trim(),
      photoUrl: String(body.photoUrl ?? "").trim(),
      role: body.role,
      status,
      allowMultipleDevices: body.allowMultipleDevices !== false,
      createdBy: user.name || user.email,
      updatedBy: user.name || user.email,
    });

    // Option 1: email them a registration link. Option 2 (always available):
    // they simply visit Register and use their approved address.
    let invited = false;
    if (body.sendInvite === true) {
      const registerUrl = new URL("/admin/login?tab=register", req.nextUrl.origin).toString();
      invited = await sendInviteEmail(
        email,
        name,
        ROLE_LABELS[employee.role as keyof typeof ROLE_LABELS],
        registerUrl
      );
    }

    const ctx = await requestContext();
    await logActivity({
      employeeId: user.isEnvAdmin ? null : user.id,
      employeeName: user.name,
      employeeRole: user.role,
      action: `added employee ${name} (${ROLE_LABELS[employee.role as keyof typeof ROLE_LABELS]})`,
      module: "employees",
      reference: email,
      ...ctx,
    });

    const doc = employee.toObject() as Record<string, unknown>;
    delete doc.passwordHash;
    return NextResponse.json({ ...doc, invited }, { status: 201 });
  } catch (err) {
    console.error("POST /api/employees failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create employee";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
