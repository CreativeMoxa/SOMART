import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { InventoryMovement } from "@/models/InventoryMovement";
import { isAdmin } from "@/lib/auth";
import { startOfWeek } from "@/lib/dateRange";

export const dynamic = "force-dynamic";

// Units sold (from invoice-sale stock movements) over today / this week /
// this month / all time. All four come from the same source and are computed
// server-side, so all-time is always ≥ month ≥ week ≥ today — no client fetch
// limit and no drift from the products' net soldCount.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = startOfWeek(now); // Saturday → Friday
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const qty = { $abs: "$qtyChange" };

    const [row] = await InventoryMovement.aggregate<{
      today: number;
      week: number;
      month: number;
      allTime: number;
    }>([
      { $match: { type: "invoice-sale" } },
      {
        $group: {
          _id: null,
          allTime: { $sum: qty },
          month: { $sum: { $cond: [{ $gte: ["$createdAt", startMonth] }, qty, 0] } },
          week: { $sum: { $cond: [{ $gte: ["$createdAt", startWeek] }, qty, 0] } },
          today: { $sum: { $cond: [{ $gte: ["$createdAt", startDay] }, qty, 0] } },
        },
      },
    ]);

    return NextResponse.json({
      today: row?.today ?? 0,
      week: row?.week ?? 0,
      month: row?.month ?? 0,
      allTime: row?.allTime ?? 0,
    });
  } catch (err) {
    console.error("GET /api/inventory/sold failed:", err);
    return NextResponse.json({ error: "Failed to load sold totals" }, { status: 500 });
  }
}
