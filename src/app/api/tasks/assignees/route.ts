import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { getCurrentUser } from "@/lib/auth";
import { isManagerRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Minimal {id, name, role} list of active employees for the task-assignment
// picker. Available to any manager (Founder & Sales can't open the CEO-only
// Employees module, but still needs to assign work).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  try {
    await connectDB();
    const employees = await Employee.find({ status: { $ne: "suspended" } })
      .select("name role")
      .sort({ name: 1 })
      .lean();
    return NextResponse.json(
      employees.map((e) => ({ id: String(e._id), name: e.name, role: e.role }))
    );
  } catch (err) {
    console.error("GET /api/tasks/assignees failed:", err);
    return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
  }
}
