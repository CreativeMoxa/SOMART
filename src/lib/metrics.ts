import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { Sale } from "@/models/Sale";
import { Customer } from "@/models/Customer";
import { Expense } from "@/models/Expense";
import { Invoice } from "@/models/Invoice";
import { PageView } from "@/models/PageView";
import { MARKETING_SOURCES, SOURCE_LABELS, type MarketingSource } from "@/lib/marketing";
import { startOfWeek } from "@/lib/dateRange";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getDashboardMetrics() {
  await connectDB();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // First day of the previous calendar month (JS rolls Jan → Dec of last year).
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const sevenDaysAgo = new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000);
  // Saturday→Friday week, matching the Sales list's "This Week" filter so the
  // dashboard's Weekly Orders count equals what the drill-down link shows.
  const weekStart = startOfWeek(now);
  // The full Saturday→Friday week immediately before this one.
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  // Rolling windows for web-view counts ("views of the last week / month / year").
  const day = 24 * 60 * 60 * 1000;
  const last7 = new Date(now.getTime() - 7 * day);
  const last30 = new Date(now.getTime() - 30 * day);
  const last365 = new Date(now.getTime() - 365 * day);

  const [sales, monthExpensesAgg, yearExpensesAgg, products, totalCustomers, unpaidInvoices, partialInvoices, webViews, lastMonthAgg] =
    await Promise.all([
      Sale.find({
        createdAt: { $gte: startOfYear },
        status: { $ne: "pending" },
      })
        .select("total profit createdAt source")
        .batchSize(10000)
        .lean(),
      Expense.aggregate([
        { $match: { date: { $gte: dayKey(startOfMonth) } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // Expenses since Jan 1 (date is a "YYYY-MM-DD" string; lexical compare = chronological).
      Expense.aggregate([
        { $match: { date: { $gte: dayKey(startOfYear) } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Product.find()
        .select("name slug price costPrice stockQty soldCount")
        .batchSize(5000)
        .lean(),
      Customer.countDocuments(),
      Invoice.countDocuments({ status: { $in: ["unpaid", "overdue"] } }),
      Invoice.countDocuments({ status: "partial" }),
      Promise.all([
        PageView.countDocuments({ createdAt: { $gte: last7 } }),
        PageView.countDocuments({ createdAt: { $gte: last30 } }),
        PageView.countDocuments({ createdAt: { $gte: last365 } }),
        PageView.estimatedDocumentCount(),
      ]).then(([week, month, year, all]) => ({ week, month, year, all })),
      Sale.aggregate<{ _id: null; rev: number; profit: number }>([
        { $match: { status: { $ne: "pending" }, createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } } },
        { $group: { _id: null, rev: { $sum: "$total" }, profit: { $sum: "$profit" } } },
      ]),
    ]);
  const lastMonthRevenue = lastMonthAgg[0]?.rev ?? 0;
  const lastMonthProfit = lastMonthAgg[0]?.profit ?? 0;

  let todaySales = 0;
  let todayProfit = 0;
  let todayOrders = 0;
  let weekOrders = 0;
  let weekRevenue = 0;
  let weekProfit = 0;
  let lastWeekOrders = 0;
  let monthOrders = 0;
  let monthRevenue = 0;
  let monthProfit = 0;
  let yearRevenue = 0;
  let yearProfit = 0;
  const monthBySource = new Map<string, { count: number; revenue: number }>();

  for (const sale of sales) {
    const created = new Date(sale.createdAt);
    yearRevenue += sale.total;
    yearProfit += sale.profit ?? 0;
    if (created >= startOfMonth) {
      monthRevenue += sale.total;
      monthProfit += sale.profit ?? 0;
      monthOrders += 1;
      const src = sale.source ?? "walk-in";
      const entry = monthBySource.get(src) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += sale.total;
      monthBySource.set(src, entry);
    }
    if (created >= weekStart) {
      weekOrders += 1;
      weekRevenue += sale.total;
      weekProfit += sale.profit ?? 0;
    } else if (created >= lastWeekStart) lastWeekOrders += 1;
    if (created >= startOfDay) {
      todaySales += sale.total;
      todayProfit += sale.profit ?? 0;
      todayOrders += 1;
    }
  }

  const allTimeBySource = await Sale.aggregate<{
    _id: string | null;
    count: number;
    revenue: number;
  }>([
    { $match: { status: { $ne: "pending" } } },
    { $group: { _id: "$source", count: { $sum: 1 }, revenue: { $sum: "$total" } } },
  ]);
  const totalsBySource = new Map(
    allTimeBySource.map((r) => [r._id ?? "walk-in", { count: r.count, revenue: r.revenue }])
  );
  const marketing = MARKETING_SOURCES.map((s: MarketingSource) => ({
    source: s,
    label: SOURCE_LABELS[s],
    monthCount: monthBySource.get(s)?.count ?? 0,
    monthRevenue: monthBySource.get(s)?.revenue ?? 0,
    totalCount: totalsBySource.get(s)?.count ?? 0,
    totalRevenue: totalsBySource.get(s)?.revenue ?? 0,
  }));

  // All-time daily sales totals (DB-side) → a contiguous day-by-day series the
  // dashboard chart can page through week by week. Gaps are filled with 0 and
  // the series always spans at least the trailing 7 days so a full week shows.
  const dailyAgg = await Sale.aggregate<{ _id: string; total: number }>([
    { $match: { status: { $ne: "pending" } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: "$total" },
      },
    },
  ]);
  const totalByDay = new Map(dailyAgg.map((r) => [r._id, r.total]));
  const sortedKeys = [...totalByDay.keys()].sort();
  const firstTime = sortedKeys.length
    ? new Date(`${sortedKeys[0]}T00:00:00Z`).getTime()
    : sevenDaysAgo.getTime();
  const startTime = Math.min(firstTime, sevenDaysAgo.getTime());
  const todayKeyStr = dayKey(startOfDay);
  const dailySeries: { date: string; label: string; dateLabel: string; total: number }[] = [];
  for (let t = startTime, guard = 0; guard < 4000; t += day, guard++) {
    const d = new Date(t);
    const key = d.toISOString().slice(0, 10);
    dailySeries.push({
      date: key,
      label: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      total: totalByDay.get(key) ?? 0,
    });
    if (key >= todayKeyStr) break;
  }

  const monthExpenses = monthExpensesAgg[0]?.total ?? 0;
  const yearExpenses = yearExpensesAgg[0]?.total ?? 0;
  const inventoryValue = products.reduce(
    (sum, p) => sum + (p.costPrice > 0 ? p.costPrice : p.price) * (p.stockQty ?? 0),
    0
  );
  const lowStock = products
    .filter((p) => (p.stockQty ?? 0) <= 5)
    .sort((a, b) => (a.stockQty ?? 0) - (b.stockQty ?? 0))
    .slice(0, 8)
    .map((p) => ({ name: p.name, slug: p.slug, stockQty: p.stockQty ?? 0 }));
  const topProducts = [...products]
    .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
    .slice(0, 5)
    .map((p) => ({ name: p.name, slug: p.slug, soldCount: p.soldCount ?? 0 }));

  const recentSales = await Sale.find({ status: { $ne: "pending" } })
    .select("number customerName total createdAt")
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  return {
    todaySales,
    todayProfit,
    todayOrders,
    weekOrders,
    weekRevenue,
    weekProfit,
    lastWeekOrders,
    monthOrders,
    webViews,
    monthRevenue,
    lastMonthRevenue,
    monthProfit,
    lastMonthProfit,
    yearProfit,
    monthExpenses,
    yearExpenses,
    netProfit: monthProfit - monthExpenses,
    yearNetProfit: yearProfit - yearExpenses,
    yearRevenue,
    inventoryValue,
    totalOrders: await Sale.countDocuments({ status: { $ne: "pending" } }),
    totalCustomers,
    totalProducts: products.length,
    unpaidInvoices,
    partialInvoices,
    lowStock,
    topProducts,
    dailySeries,
    marketing,
    recentSales: JSON.parse(JSON.stringify(recentSales)) as {
      _id: string;
      number: string;
      customerName: string;
      total: number;
      createdAt: string;
    }[],
  };
}

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;
