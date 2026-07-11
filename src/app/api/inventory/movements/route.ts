import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { InventoryMovement } from "@/models/InventoryMovement";
import { isAdmin } from "@/lib/auth";

// Read-only stock history. Movements are append-only and never deleted.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = {};
    if (sp.get("productId")) filter.productId = sp.get("productId");
    if (sp.get("type")) filter.type = sp.get("type");
    const limit = Math.min(2000, Number(sp.get("limit")) || 500);

    const movements = await InventoryMovement.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return NextResponse.json(movements);
  } catch (err) {
    console.error("GET /api/inventory/movements failed:", err);
    return NextResponse.json({ error: "Failed to load stock history" }, { status: 500 });
  }
}
