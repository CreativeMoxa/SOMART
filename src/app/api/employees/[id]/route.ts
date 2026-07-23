import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Employee, EMPLOYEE_STATUSES, normalizeEmail } from "@/models/Employee";
import { requireModule, requestContext } from "@/lib/auth";
import { isRole } from "@/lib/roles";
import { logActivity } from "@/models/ActivityLog";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireModule("employees");
  if (!user) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  try {
    await connectDB();
    const { id } = await params;
    const employee = await Employee.findById(id).select("-passwordHash").lean();
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    return NextResponse.json(employee);
  } catch (err) {
    console.error("GET /api/employees/[id] failed:", err);
    return NextResponse.json({ error: "Failed to load employee" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireModule("employees");
  if (!user) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  try {
    await connectDB();
    const { id } = await params;
    const employee = await Employee.findById(id);
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const body = await req.json();
    const changes: string[] = [];

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
      if (name !== employee.name) changes.push("name");
      employee.name = name;
    }
    if (body.email !== undefined) {
      const email = normalizeEmail(body.email);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
      }
      if (email !== employee.email) {
        if (await Employee.exists({ email, _id: { $ne: employee._id } })) {
          return NextResponse.json({ error: "That email is already in use" }, { status: 400 });
        }
        changes.push("email");
        employee.email = email;
      }
    }
    if (body.phone !== undefined) employee.phone = String(body.phone).trim();
    if (body.photoUrl !== undefined) employee.photoUrl = String(body.photoUrl).trim();

    if (body.role !== undefined) {
      if (!isRole(body.role)) {
        return NextResponse.json({ error: "Please choose a valid position" }, { status: 400 });
      }
      if (body.role !== employee.role) {
        changes.push(`role → ${body.role}`);
        employee.role = body.role;
        // A role change must not leave wider access alive on an old session.
        employee.sessionVersion += 1;
      }
    }

    if (body.status !== undefined) {
      if (!EMPLOYEE_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (body.status !== employee.status) {
        changes.push(`status → ${body.status}`);
        employee.status = body.status;
        // Suspending/deactivating terminates every active session at once.
        if (body.status !== "active") employee.sessionVersion += 1;
      }
    }

    if (body.allowMultipleDevices !== undefined) {
      const next = body.allowMultipleDevices !== false;
      if (next !== employee.allowMultipleDevices) {
        changes.push(`multiple devices ${next ? "on" : "off"}`);
        employee.allowMultipleDevices = next;
        // Tightening to one device keeps only the newest session.
        if (!next) employee.sessionVersion += 1;
      }
    }

    // Sign every device out on demand.
    if (body.revokeSessions === true) {
      employee.sessionVersion += 1;
      employee.currentSessionId = "";
      changes.push("signed out of all devices");
    }

    employee.updatedBy = user.name || user.email;
    await employee.save();

    const ctx = await requestContext();
    await logActivity({
      employeeId: user.isEnvAdmin ? null : user.id,
      employeeName: user.name,
      employeeRole: user.role,
      action: `updated employee ${employee.name}${changes.length ? ` (${changes.join(", ")})` : ""}`,
      module: "employees",
      reference: employee.email,
      ...ctx,
    });

    const doc = employee.toObject() as Record<string, unknown>;
    delete doc.passwordHash;
    return NextResponse.json(doc);
  } catch (err) {
    console.error("PATCH /api/employees/[id] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update employee";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireModule("employees");
  if (!user) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  try {
    await connectDB();
    const { id } = await params;
    const employee = await Employee.findById(id);
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    // Don't let the CEO delete their own account and lock the module.
    if (!user.isEnvAdmin && String(employee._id) === user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }
    if (employee.role === "founder-ceo") {
      const ceoCount = await Employee.countDocuments({ role: "founder-ceo" });
      if (ceoCount <= 1) {
        return NextResponse.json(
          { error: "You cannot delete the only Founder & CEO." },
          { status: 400 }
        );
      }
    }

    const { name, email } = employee;
    // Deleting removes the record, which immediately invalidates its sessions
    // (getCurrentUser can no longer resolve the employee).
    await employee.deleteOne();

    const ctx = await requestContext();
    await logActivity({
      employeeId: user.isEnvAdmin ? null : user.id,
      employeeName: user.name,
      employeeRole: user.role,
      action: `deleted employee ${name}`,
      module: "employees",
      reference: email,
      ...ctx,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/employees/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
