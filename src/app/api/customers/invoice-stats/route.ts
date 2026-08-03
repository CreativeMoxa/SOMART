import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Per-customer invoice stats for the Customers table: how many invoices each
// customer has, and how much money is still outstanding (unpaid + overdue +
// the remaining balance of partially-paid invoices).
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const rows = await Invoice.aggregate<{ _id: unknown; count: number; outstanding: number }>([
      { $match: { customerId: { $ne: null } } },
      {
        $group: {
          _id: "$customerId",
          count: { $sum: 1 },
          outstanding: {
            $sum: {
              $cond: [
                { $in: ["$status", ["unpaid", "overdue", "partial"]] },
                { $subtract: ["$total", { $ifNull: ["$amountPaid", 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const stats: Record<string, { count: number; outstanding: number }> = {};
    for (const r of rows) {
      stats[String(r._id)] = {
        count: r.count,
        outstanding: Math.round(Math.max(0, r.outstanding) * 100) / 100,
      };
    }
    return NextResponse.json(stats);
  } catch (err) {
    console.error("GET /api/customers/invoice-stats failed:", err);
    return NextResponse.json({ error: "Failed to load invoice stats" }, { status: 500 });
  }
}
