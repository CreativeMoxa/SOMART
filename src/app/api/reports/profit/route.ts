import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { isAdmin } from "@/lib/auth";
import { blendedMarginPercent, blendedMarkupPercent, round2 } from "@/lib/profit";

// Fast profit reporting. All aggregation happens in MongoDB over the profit
// values already stored on each Sale (never recalculated here), so opening the
// report stays quick and historically accurate no matter how data grows.

type Granularity = "day" | "week" | "month" | "year";

function bucketExpr(granularity: Granularity) {
  const date = "$createdAt";
  switch (granularity) {
    case "year":
      return { $dateToString: { format: "%Y", date } };
    case "month":
      return { $dateToString: { format: "%Y-%m", date } };
    case "week":
      return {
        $concat: [
          { $toString: { $isoWeekYear: date } },
          "-W",
          { $toString: { $isoWeek: date } },
        ],
      };
    default:
      return { $dateToString: { format: "%Y-%m-%d", date } };
  }
}

type GroupRow = {
  _id: string | null;
  revenue: number;
  cost?: number;
  profit: number;
  count?: number;
  qty?: number;
};

const lineBranch = (field: string) => [
  { $unwind: "$items" },
  {
    $group: {
      _id: `$items.${field}`,
      revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
      cost: { $sum: { $multiply: ["$items.costPrice", "$items.qty"] } },
      profit: { $sum: { $multiply: ["$items.profitAmount", "$items.qty"] } },
      qty: { $sum: "$items.qty" },
    },
  },
  { $sort: { profit: -1 as const } },
  { $limit: 200 },
];

const docBranch = (field: string) => [
  {
    $group: {
      _id: `$${field}`,
      revenue: { $sum: "$total" },
      cost: { $sum: "$totalCost" },
      profit: { $sum: "$profit" },
      count: { $sum: 1 },
    },
  },
  { $sort: { profit: -1 as const } },
];

function shape(rows: GroupRow[]) {
  return rows.map((r) => {
    const revenue = round2(r.revenue ?? 0);
    const cost = round2(r.cost ?? 0);
    const profit = round2(r.profit ?? 0);
    return {
      key: r._id || "—",
      revenue,
      cost,
      profit,
      qty: r.qty ?? 0,
      count: r.count ?? 0,
      marginPercent: blendedMarginPercent(revenue, profit),
      markupPercent: blendedMarkupPercent(cost, profit),
    };
  });
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const granularity = (sp.get("granularity") as Granularity) || "day";

    const match: Record<string, unknown> = { status: { $ne: "pending" } };
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = new Date(`${from}T00:00:00`);
    if (to) createdAt.$lte = new Date(`${to}T23:59:59.999`);
    if (from || to) match.createdAt = createdAt;

    const [result] = await Sale.aggregate([
      { $match: match },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                revenue: { $sum: "$total" },
                cost: { $sum: "$totalCost" },
                profit: { $sum: "$profit" },
                count: { $sum: 1 },
              },
            },
          ],
          byProduct: lineBranch("name"),
          byCategory: lineBranch("category"),
          byBrand: lineBranch("brand"),
          bySource: docBranch("source"),
          byCustomerType: docBranch("customerType"),
          timeseries: [
            {
              $group: {
                _id: bucketExpr(granularity),
                revenue: { $sum: "$total" },
                cost: { $sum: "$totalCost" },
                profit: { $sum: "$profit" },
              },
            },
            { $sort: { _id: 1 as const } },
          ],
        },
      },
    ]);

    const k = result?.kpis?.[0] ?? { revenue: 0, cost: 0, profit: 0, count: 0 };
    const revenue = round2(k.revenue);
    const cost = round2(k.cost);
    const profit = round2(k.profit);

    return NextResponse.json({
      kpis: {
        revenue,
        cost,
        profit,
        count: k.count,
        avgMarginPercent: blendedMarginPercent(revenue, profit),
        avgMarkupPercent: blendedMarkupPercent(cost, profit),
      },
      byProduct: shape(result?.byProduct ?? []),
      byCategory: shape(result?.byCategory ?? []),
      byBrand: shape(result?.byBrand ?? []),
      bySource: shape(result?.bySource ?? []),
      byCustomerType: shape(result?.byCustomerType ?? []),
      timeseries: (result?.timeseries ?? []).map((r: GroupRow) => ({
        bucket: r._id,
        revenue: round2(r.revenue),
        cost: round2(r.cost ?? 0),
        profit: round2(r.profit),
      })),
    });
  } catch (err) {
    console.error("GET /api/reports/profit failed:", err);
    return NextResponse.json({ error: "Failed to build profit report" }, { status: 500 });
  }
}
