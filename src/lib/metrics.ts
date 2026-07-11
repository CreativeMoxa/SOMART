import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { Sale } from "@/models/Sale";
import { Customer } from "@/models/Customer";
import { Expense } from "@/models/Expense";
import { Invoice } from "@/models/Invoice";
import { MARKETING_SOURCES, SOURCE_LABELS, type MarketingSource } from "@/lib/marketing";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getDashboardMetrics() {
  await connectDB();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const sevenDaysAgo = new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [sales, monthExpensesAgg, products, totalCustomers, unpaidInvoices] =
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
      Product.find()
        .select("name slug price costPrice stockQty soldCount")
        .batchSize(5000)
        .lean(),
      Customer.countDocuments(),
      Invoice.countDocuments({ status: { $in: ["unpaid", "overdue"] } }),
    ]);

  let todaySales = 0;
  let monthRevenue = 0;
  let monthProfit = 0;
  let yearRevenue = 0;
  const dailyTotals = new Map<string, number>();
  const monthBySource = new Map<string, { count: number; revenue: number }>();

  for (const sale of sales) {
    const created = new Date(sale.createdAt);
    yearRevenue += sale.total;
    if (created >= startOfMonth) {
      monthRevenue += sale.total;
      monthProfit += sale.profit ?? 0;
      const src = sale.source ?? "walk-in";
      const entry = monthBySource.get(src) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += sale.total;
      monthBySource.set(src, entry);
    }
    if (created >= startOfDay) todaySales += sale.total;
    if (created >= sevenDaysAgo) {
      const key = dayKey(created);
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + sale.total);
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

  const last7Days: { label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfDay.getTime() - i * 24 * 60 * 60 * 1000);
    last7Days.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      total: dailyTotals.get(dayKey(d)) ?? 0,
    });
  }

  const monthExpenses = monthExpensesAgg[0]?.total ?? 0;
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
    monthRevenue,
    monthProfit,
    monthExpenses,
    netProfit: monthProfit - monthExpenses,
    yearRevenue,
    inventoryValue,
    totalOrders: await Sale.countDocuments({ status: { $ne: "pending" } }),
    totalCustomers,
    totalProducts: products.length,
    unpaidInvoices,
    lowStock,
    topProducts,
    last7Days,
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
