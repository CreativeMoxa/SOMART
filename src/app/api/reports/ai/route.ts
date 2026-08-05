import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { generateBIReport } from "@/lib/bi/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/reports/ai { from, to } → AI Business Intelligence report (JSON).
// Guarded to roles that can open the Reports module.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccess(user.role, "reports")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to : "";
    const report = await generateBIReport(from, to);
    return NextResponse.json(report);
  } catch (err) {
    console.error("POST /api/reports/ai failed:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
