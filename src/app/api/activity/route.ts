import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ActivityLog } from "@/models/ActivityLog";
import { requireModule } from "@/lib/auth";

// The activity log lives inside the CEO-only Employees module.
export async function GET() {
  const user = await requireModule("employees");
  if (!user) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  try {
    await connectDB();
    const entries = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    return NextResponse.json(entries);
  } catch (err) {
    console.error("GET /api/activity failed:", err);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
