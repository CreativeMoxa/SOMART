import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Invoice } from "@/models/Invoice";
import { Product } from "@/models/Product";
import { Customer } from "@/models/Customer";
import { Expense } from "@/models/Expense";
import { Shipment } from "@/models/Shipment";
import { getSettings } from "@/models/Setting";
import { SOURCE_LABELS, type MarketingSource } from "@/lib/marketing";
import { CUSTOMER_TYPE_LABELS, type CustomerType } from "@/lib/customerType";
import { paymentMethodLabel } from "@/lib/payment";
import type { BIBar, BIInsight, BIRec, BIReport, BITable } from "./types";

// Business runs on Somalia time (UTC+3); shift/time analysis converts from UTC.
const TZ_OFFSET_HRS = 3;

const money = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 10) / 10}%`;
const growth = (curr: number, prev: number) => (prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

type SaleLean = {
  _id: unknown; total: number; profit: number; totalCost?: number; subtotal?: number;
  paymentMethod?: string; source?: string; customerType?: string;
  customerId?: unknown; customerName?: string; createdAt: string | Date;
  items: { productId?: unknown; name: string; price: number; qty: number; profitAmount?: number; category?: string; brand?: string }[];
};

function topN<T>(map: Map<string, T>, valueOf: (t: T) => number, n: number): [string, T][] {
  return [...map.entries()].sort((a, b) => valueOf(b[1]) - valueOf(a[1])).slice(0, n);
}

export async function generateBIReport(fromStr: string, toStr: string): Promise<BIReport> {
  await connectDB();

  const now = new Date();
  const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : new Date(0);
  const to = toStr ? new Date(`${toStr}T23:59:59.999Z`) : now;
  const hasComparison = Boolean(fromStr);
  const spanMs = Math.max(1, to.getTime() - from.getTime());
  const prevFrom = new Date(from.getTime() - spanMs);
  const prevTo = new Date(from.getTime() - 1);

  const settings = await getSettings();

  const [salesRaw, prevSales, products, customers, expenses, shipments, unpaidAgg] = await Promise.all([
    Sale.find({ createdAt: { $gte: from, $lte: to }, status: { $ne: "pending" } })
      .select("total profit totalCost subtotal paymentMethod source customerType customerId customerName createdAt items")
      .lean<SaleLean[]>(),
    hasComparison
      ? Sale.find({ createdAt: { $gte: prevFrom, $lte: prevTo }, status: { $ne: "pending" } }).select("total profit").lean<{ total: number; profit: number }[]>()
      : Promise.resolve([] as { total: number; profit: number }[]),
    Product.find().select("name brand category price costPrice stockQty soldCount minStock").lean(),
    Customer.find().select("name address createdAt").lean(),
    Expense.find({ date: { $gte: fromStr || "0000-00-00", $lte: toStr || "9999-99-99" } }).select("title category amount date").lean(),
    Shipment.find({ createdAt: { $gte: from, $lte: to } }).select("freightType name cargo totalCost expectedSalesValue status received receivedAt createdAt").lean(),
    Invoice.aggregate<{ _id: null; outstanding: number; count: number }>([
      { $match: { status: { $in: ["unpaid", "overdue", "partial"] } } },
      { $group: { _id: null, outstanding: { $sum: { $subtract: ["$total", { $ifNull: ["$amountPaid", 0] }] } }, count: { $sum: 1 } } },
    ]),
  ]);

  const sales = salesRaw;
  const custCity = new Map(customers.map((c) => [String(c._id), (c.address || "").trim()]));

  // ── Core totals ───────────────────────────────────────────────────────────
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const grossProfit = sales.reduce((s, x) => s + (x.profit ?? 0), 0);
  const cogs = sales.reduce((s, x) => s + (x.totalCost ?? 0), 0);
  const orders = sales.length;
  const aov = orders ? revenue / orders : 0;
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossProfit - expenseTotal;
  const grossMargin = revenue ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue ? (netProfit / revenue) * 100 : 0;

  const prevRevenue = prevSales.reduce((s, x) => s + x.total, 0);
  const prevProfit = prevSales.reduce((s, x) => s + (x.profit ?? 0), 0);
  const revGrowth = growth(revenue, prevRevenue);
  const profitGrowth = growth(grossProfit, prevProfit);
  const orderGrowth = growth(orders, prevSales.length);

  // ── Sales: by day + by payment ──────────────────────────────────────────────
  const byDayMap = new Map<string, number>();
  const byPayMap = new Map<string, number>();
  for (const s of sales) {
    const d = new Date(s.createdAt);
    byDayMap.set(dayKey(d), (byDayMap.get(dayKey(d)) ?? 0) + s.total);
    const p = paymentMethodLabel(s.paymentMethod);
    byPayMap.set(p, (byPayMap.get(p) ?? 0) + s.total);
  }
  const byDay: BIBar[] = [...byDayMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([label, value]) => ({ label: label.slice(5), value, display: money(value) }));
  const byPayment: BIBar[] = [...byPayMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, display: money(value) }));

  // ── Customers ───────────────────────────────────────────────────────────────
  const custAgg = new Map<string, { name: string; spend: number; orders: number }>();
  const byTypeMap = new Map<string, number>();
  const byCityMap = new Map<string, number>();
  for (const s of sales) {
    const key = s.customerId ? String(s.customerId) : `name:${s.customerName ?? "Walk-in"}`;
    const e = custAgg.get(key) ?? { name: s.customerName || "Walk-in", spend: 0, orders: 0 };
    e.spend += s.total; e.orders += 1; custAgg.set(key, e);
    const tLabel = CUSTOMER_TYPE_LABELS[(s.customerType as CustomerType)] ?? "Retail";
    byTypeMap.set(tLabel, (byTypeMap.get(tLabel) ?? 0) + s.total);
    const city: string = s.customerId ? custCity.get(String(s.customerId)) ?? "" : "";
    if (city) byCityMap.set(city, (byCityMap.get(city) ?? 0) + s.total);
  }
  const namedCustomers = [...custAgg.entries()].filter(([k]) => k.startsWith("name:") === false || true);
  const repeatCustomers = namedCustomers.filter(([, v]) => v.orders > 1).length;
  const distinctCustomers = custAgg.size;
  const repeatRate = distinctCustomers ? (repeatCustomers / distinctCustomers) * 100 : 0;
  const topCustomers = topN(custAgg, (v) => v.spend, 8);
  const byType: BIBar[] = [...byTypeMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, display: money(value) }));
  const byCity: BIBar[] = [...byCityMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value, display: money(value) }));

  // ── Products + market basket ────────────────────────────────────────────────
  const prodAgg = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
  const catMap = new Map<string, number>();
  const brandMap = new Map<string, number>();
  const pairMap = new Map<string, number>();
  for (const s of sales) {
    const names = new Set<string>();
    for (const it of s.items) {
      const name = it.name || "Item";
      const e = prodAgg.get(name) ?? { name, qty: 0, revenue: 0, profit: 0 };
      e.qty += it.qty; e.revenue += it.price * it.qty; e.profit += (it.profitAmount ?? 0) * it.qty;
      prodAgg.set(name, e);
      if (it.category) catMap.set(it.category, (catMap.get(it.category) ?? 0) + it.price * it.qty);
      if (it.brand) brandMap.set(it.brand, (brandMap.get(it.brand) ?? 0) + it.price * it.qty);
      names.add(name);
    }
    const arr = [...names];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const pair = [arr[i], arr[j]].sort().join(" + ");
        pairMap.set(pair, (pairMap.get(pair) ?? 0) + 1);
      }
  }
  const topProducts = topN(prodAgg, (v) => v.revenue, 10);
  const topByRevenue: BITable = {
    columns: ["Product", "Units", "Revenue", "Profit"],
    rows: topProducts.map(([, v]) => [v.name, v.qty, money(v.revenue), money(v.profit)]),
  };
  const categories: BIBar[] = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value, display: money(value) }));
  const brands: BIBar[] = [...brandMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value, display: money(value) }));
  const basket = [...pairMap.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([pair, count]) => ({ pair, count, note: `Bought together in ${count} orders` }));
  const fastMovers: BITable = {
    columns: ["Product", "Units sold"],
    rows: topN(prodAgg, (v) => v.qty, 5).map(([, v]) => [v.name, v.qty]),
  };
  // Slow movers: in stock but sold little/nothing in the period.
  const soldNames = new Set([...prodAgg.keys()].map((n) => n.toLowerCase()));
  const slow = products
    .filter((p) => (p.stockQty ?? 0) > 0)
    .map((p) => ({ name: p.name, stock: p.stockQty ?? 0, sold: prodAgg.get(p.name)?.qty ?? (soldNames.has(p.name.toLowerCase()) ? 0 : 0) }))
    .filter((p) => p.sold === 0)
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 6);
  const slowMovers: BITable = { columns: ["Product", "In stock", "Sold (period)"], rows: slow.map((p) => [p.name, p.stock, p.sold]) };

  // ── Shopping time (shift) ───────────────────────────────────────────────────
  const hourMap = new Array(24).fill(0) as number[];
  const dowMap = new Array(7).fill(0) as number[];
  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (const s of sales) {
    const d = new Date(s.createdAt);
    const localH = (d.getUTCHours() + TZ_OFFSET_HRS) % 24;
    hourMap[localH] += 1;
    dowMap[d.getUTCDay()] += 1;
  }
  const byHour: BIBar[] = hourMap.map((value, h) => ({ label: `${String(h).padStart(2, "0")}:00`, value }));
  const byWeekday: BIBar[] = dowMap.map((value, i) => ({ label: DOW[i].slice(0, 3), value }));
  const peakHourIdx = hourMap.indexOf(Math.max(...hourMap, 0));
  const peakDayIdx = dowMap.indexOf(Math.max(...dowMap, 0));
  const shift = (h: number) => (h >= 6 && h < 12 ? "Morning" : h >= 12 && h < 17 ? "Afternoon" : h >= 17 && h < 22 ? "Evening" : "Night");
  const shiftTotals: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  hourMap.forEach((c, h) => (shiftTotals[shift(h)] += c));
  const peakShift = Object.entries(shiftTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // ── Marketing ───────────────────────────────────────────────────────────────
  const chanMap = new Map<string, { rev: number; orders: number; profit: number }>();
  for (const s of sales) {
    const label = SOURCE_LABELS[(s.source as MarketingSource)] ?? "Walk-in";
    const e = chanMap.get(label) ?? { rev: 0, orders: 0, profit: 0 };
    e.rev += s.total; e.orders += 1; e.profit += s.profit ?? 0; chanMap.set(label, e);
  }
  const chanSorted = [...chanMap.entries()].sort((a, b) => b[1].rev - a[1].rev);
  const byChannel: BITable = {
    columns: ["Channel", "Orders", "Revenue", "Profit", "Share"],
    rows: chanSorted.map(([label, v]) => [label, v.orders, money(v.rev), money(v.profit), revenue ? `${Math.round((v.rev / revenue) * 100)}%` : "0%"]),
  };

  // ── Inventory ───────────────────────────────────────────────────────────────
  const invValue = products.reduce((s, p) => s + (p.costPrice > 0 ? p.costPrice : p.price) * (p.stockQty ?? 0), 0);
  const lowStock = products.filter((p) => (p.stockQty ?? 0) <= (p.minStock ?? 5));
  const outOfStock = products.filter((p) => (p.stockQty ?? 0) === 0);
  const restock: BITable = {
    columns: ["Product", "In stock", "Min", "Sold (period)"],
    rows: lowStock.sort((a, b) => (a.stockQty ?? 0) - (b.stockQty ?? 0)).slice(0, 8).map((p) => [p.name, p.stockQty ?? 0, p.minStock ?? 5, prodAgg.get(p.name)?.qty ?? 0]),
  };

  // ── Freight ─────────────────────────────────────────────────────────────────
  const air = shipments.filter((s) => s.freightType === "air");
  const sea = shipments.filter((s) => s.freightType === "sea");
  const freightRow = (list: typeof shipments, label: string) => {
    const cost = list.reduce((s, x) => s + (x.totalCost ?? 0), 0);
    const expected = list.reduce((s, x) => s + (x.expectedSalesValue ?? 0), 0);
    const received = list.filter((x) => x.status === "received").length;
    return [label, list.length, money(cost), money(expected), money(expected - cost), `${received}/${list.length}`];
  };
  const byTypeFreight: BITable = {
    columns: ["Freight", "Shipments", "Cost", "Expected sales", "Expected margin", "Received"],
    rows: [freightRow(air, "Air"), freightRow(sea, "Sea")].filter((r) => (r[1] as number) > 0),
  };
  const fwdMap = new Map<string, { n: number; cost: number; expected: number }>();
  for (const s of shipments) {
    const key = (s.cargo || "Unspecified").trim() || "Unspecified";
    const e = fwdMap.get(key) ?? { n: 0, cost: 0, expected: 0 };
    e.n += 1; e.cost += s.totalCost ?? 0; e.expected += s.expectedSalesValue ?? 0; fwdMap.set(key, e);
  }
  const forwarders: BITable = {
    columns: ["Forwarder / supplier", "Shipments", "Cost", "Expected margin"],
    rows: [...fwdMap.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, 6).map(([k, v]) => [k, v.n, money(v.cost), money(v.expected - v.cost)]),
  };

  // ── Financial ───────────────────────────────────────────────────────────────
  const expCatMap = new Map<string, number>();
  for (const e of expenses) expCatMap.set(e.category, (expCatMap.get(e.category) ?? 0) + e.amount);
  const expensesByCategory: BIBar[] = [...expCatMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, display: money(value) }));

  // ── Forecast (linear on daily revenue) ──────────────────────────────────────
  let forecast: BIReport["forecast"] = null;
  const days = byDay.length;
  if (days >= 5) {
    const ys = [...byDayMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
    const nDays = ys.length;
    const xs = ys.map((_, i) => i);
    const meanX = xs.reduce((a, b) => a + b, 0) / nDays;
    const meanY = ys.reduce((a, b) => a + b, 0) / nDays;
    const slope = xs.reduce((a, x, i) => a + (x - meanX) * (ys[i] - meanY), 0) / (xs.reduce((a, x) => a + (x - meanX) ** 2, 0) || 1);
    const avgDaily = meanY;
    const projNext = Math.max(0, avgDaily * nDays + slope * (nDays * nDays) / 2); // rough next-window projection
    const trendWord = slope > avgDaily * 0.02 ? "rising" : slope < -avgDaily * 0.02 ? "declining" : "steady";
    forecast = {
      kpis: [
        { label: "Avg daily revenue", value: money(avgDaily) },
        { label: "Daily trend", value: `${slope >= 0 ? "+" : ""}${money(slope)}/day`, hint: trendWord },
        { label: "Projected next period", value: money(projNext), hint: "Same length as selected" },
      ],
      narrative: [
        `Daily revenue is ${trendWord}. Extending the current trend, the next ${nDays}-day window projects around ${money(projNext)} in revenue.`,
        trendWord === "declining"
          ? "The projection assumes no intervention — the recommendations below are aimed at reversing it."
          : "Keep the drivers behind this trend (top channel, top products) well stocked and promoted to hold the trajectory.",
      ],
    };
  }

  // ── Insights, opportunities, risks ──────────────────────────────────────────
  const keyInsights: BIInsight[] = [];
  const opportunities: BIInsight[] = [];
  const risks: BIInsight[] = [];

  if (topProducts[0]) keyInsights.push({ title: "Top product", detail: `${topProducts[0][1].name} led with ${money(topProducts[0][1].revenue)} revenue (${topProducts[0][1].qty} units).`, tone: "positive" });
  if (chanSorted[0]) keyInsights.push({ title: "Best channel", detail: `${chanSorted[0][0]} drove ${money(chanSorted[0][1].rev)} (${revenue ? Math.round((chanSorted[0][1].rev / revenue) * 100) : 0}% of revenue).`, tone: "positive" });
  if (byCity[0]) keyInsights.push({ title: "Top city", detail: `${byCity[0].label} generated the most revenue (${money(byCity[0].value)}).`, tone: "neutral" });
  keyInsights.push({ title: "Best shopping time", detail: `Most orders come in during the ${peakShift.toLowerCase()} (peak hour ${String(peakHourIdx).padStart(2, "0")}:00), busiest on ${DOW[peakDayIdx]}.`, tone: "neutral" });
  if (hasComparison) keyInsights.push({ title: "Revenue trend", detail: `Revenue ${revGrowth >= 0 ? "grew" : "fell"} ${pct(revGrowth)} vs the previous period.`, tone: revGrowth >= 0 ? "positive" : "negative" });

  // Opportunities
  if (basket[0]) opportunities.push({ title: "Bundle opportunity", detail: `"${basket[0].pair}" are frequently bought together (${basket[0].count} orders). Offer them as a bundle to lift basket size.`, tone: "opportunity" });
  const highMargin = topN(prodAgg, (v) => (v.revenue > 0 ? (v.profit / v.revenue) : 0), 30).filter(([, v]) => v.revenue > 0 && v.profit / v.revenue > 0.35 && v.qty <= (aov > 0 ? 10 : 5));
  if (highMargin[0]) opportunities.push({ title: "Promote high-margin item", detail: `${highMargin[0][1].name} earns a strong margin but sells modestly — featuring it could raise profit without more traffic.`, tone: "opportunity" });
  if (byCity[0]) opportunities.push({ title: "Double down on a city", detail: `${byCity[0].label} is your strongest market — concentrated ads there should convert efficiently.`, tone: "opportunity" });
  if (repeatRate < 30 && distinctCustomers > 5) opportunities.push({ title: "Grow repeat business", detail: `Only ${Math.round(repeatRate)}% of customers ordered more than once. A simple follow-up/loyalty nudge can lift repeat rate.`, tone: "opportunity" });

  // Risks
  const soldTopNames = topN(prodAgg, (v) => v.qty, 10).map(([n]) => n.toLowerCase());
  const outTopSellers = outOfStock.filter((p) => soldTopNames.includes(p.name.toLowerCase()));
  if (outTopSellers.length) risks.push({ title: "Top seller out of stock", detail: `${outTopSellers.map((p) => p.name).slice(0, 3).join(", ")} sold well but ${outTopSellers.length === 1 ? "is" : "are"} out of stock — you're losing sales now.`, tone: "risk" });
  if (hasComparison && revGrowth < -5) risks.push({ title: "Revenue declining", detail: `Revenue dropped ${pct(revGrowth)} versus the previous period — investigate the weakest channel and slow movers.`, tone: "risk" });
  if (chanSorted[0] && revenue && chanSorted[0][1].rev / revenue > 0.6) risks.push({ title: "Channel over-reliance", detail: `${chanSorted[0][0]} accounts for ${Math.round((chanSorted[0][1].rev / revenue) * 100)}% of revenue. Diversify so one channel change can't sink sales.`, tone: "risk" });
  if (topCustomers[0] && revenue && topCustomers[0][1].spend / revenue > 0.25) risks.push({ title: "Customer concentration", detail: `${topCustomers[0][1].name} makes up ${Math.round((topCustomers[0][1].spend / revenue) * 100)}% of revenue — a risky dependency on one buyer.`, tone: "risk" });
  if (slow.length >= 3) risks.push({ title: "Capital tied in slow stock", detail: `${slow.length}+ in-stock products had no sales this period, tying up working capital. Consider a clearance push.`, tone: "risk" });
  const outstanding = unpaidAgg[0]?.outstanding ?? 0;
  if (outstanding > 0) risks.push({ title: "Unpaid invoices", detail: `${money(outstanding)} is outstanding across ${unpaidAgg[0]?.count ?? 0} invoices — chase collections to protect cash flow.`, tone: "risk" });

  // ── Recommendations (prioritised) ───────────────────────────────────────────
  const recommendations: BIRec[] = [];
  for (const p of outTopSellers.slice(0, 3)) recommendations.push({ priority: "High", action: `Restock ${p.name} immediately`, reason: "It's a proven seller but currently out of stock — every day out is lost revenue." });
  for (const p of lowStock.filter((p) => (prodAgg.get(p.name)?.qty ?? 0) > 0).slice(0, 3)) recommendations.push({ priority: "High", action: `Reorder ${p.name} before it runs out`, reason: `Only ${p.stockQty} left and still selling.` });
  if (basket[0]) recommendations.push({ priority: "Medium", action: `Bundle "${basket[0].pair}"`, reason: `Frequently bought together (${basket[0].count} orders) — a bundle raises average order value.` });
  if (byCity[0]) recommendations.push({ priority: "Medium", action: `Focus marketing on ${byCity[0].label}`, reason: "It's already your top-revenue city, so ad spend there converts best." });
  if (chanSorted.length > 1) {
    const worst = chanSorted[chanSorted.length - 1];
    if (worst[1].rev < revenue * 0.05 && worst[1].orders > 0) recommendations.push({ priority: "Medium", action: `Review spending on ${worst[0]}`, reason: `It brought only ${money(worst[1].rev)} — reallocate budget to ${chanSorted[0][0]}.` });
  }
  if (highMargin[0]) recommendations.push({ priority: "Medium", action: `Promote high-margin ${highMargin[0][1].name}`, reason: "Strong margin, modest volume — featuring it lifts profit efficiently." });
  if (slow.length >= 3) recommendations.push({ priority: "Low", action: "Run a clearance on slow movers", reason: `${slow.length} products didn't sell this period — free up cash and shelf space.` });
  if (outstanding > 0) recommendations.push({ priority: "High", action: "Collect outstanding invoices", reason: `${money(outstanding)} owed — send reminders to protect cash flow.` });
  if (repeatRate < 30 && distinctCustomers > 5) recommendations.push({ priority: "Low", action: "Start a simple loyalty follow-up", reason: `Repeat rate is ${Math.round(repeatRate)}% — re-engaging past buyers is cheaper than new acquisition.` });

  // ── Health score ────────────────────────────────────────────────────────────
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const profScore = clamp(netMargin >= 0 ? 50 + netMargin * 2 : 40 + netMargin); // margin-driven
  const growthScore = hasComparison ? clamp(50 + revGrowth) : 60;
  const invScore = clamp(products.length ? 100 - (outOfStock.length / products.length) * 100 - (slow.length * 3) : 60);
  const repeatScore = clamp(repeatRate * 1.6 + 20);
  const diversityScore = clamp(revenue && chanSorted[0] ? 100 - Math.max(0, (chanSorted[0][1].rev / revenue) * 100 - 40) * 1.5 : 60);
  const cashScore = clamp(revenue ? 100 - Math.min(100, (outstanding / (revenue || 1)) * 100) : 70);
  const drivers = [
    { label: "Profitability", score: profScore, note: `${Math.round(netMargin)}% net margin` },
    { label: "Growth", score: growthScore, note: hasComparison ? `${pct(revGrowth)} revenue` : "no comparison period" },
    { label: "Inventory health", score: invScore, note: `${outOfStock.length} out of stock, ${slow.length} slow movers` },
    { label: "Customer loyalty", score: repeatScore, note: `${Math.round(repeatRate)}% repeat rate` },
    { label: "Channel diversity", score: diversityScore, note: chanSorted[0] ? `top channel ${revenue ? Math.round((chanSorted[0][1].rev / revenue) * 100) : 0}%` : "—" },
    { label: "Cash health", score: cashScore, note: outstanding > 0 ? `${money(outstanding)} outstanding` : "no dues" },
  ];
  const score = clamp(drivers.reduce((s, d) => s + d.score, 0) / drivers.length);
  const grade = score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Fair" : "Needs attention";

  // ── Narratives ──────────────────────────────────────────────────────────────
  const periodLabel = fromStr ? `${fromStr} → ${toStr || "today"}` : "All time";
  const cmp = (g: number) => (hasComparison ? `, ${g >= 0 ? "up" : "down"} ${pct(Math.abs(g))} vs the previous period` : "");

  const report: BIReport = {
    meta: {
      company: settings.companyName || "SOMART",
      periodLabel,
      from: fromStr,
      to: toStr,
      generatedAt: now.toISOString(),
      hasComparison,
      prevPeriodLabel: hasComparison ? `${dayKey(prevFrom)} → ${dayKey(prevTo)}` : "",
      dataPoints: orders,
    },
    health: { score, grade, drivers },
    executive: {
      kpis: [
        { label: "Revenue", value: money(revenue), hint: hasComparison ? pct(revGrowth) : undefined },
        { label: "Gross profit", value: money(grossProfit), hint: `${Math.round(grossMargin)}% margin` },
        { label: "Net profit", value: money(netProfit), hint: `${Math.round(netMargin)}% margin` },
        { label: "Orders", value: String(orders), hint: hasComparison ? pct(orderGrowth) : undefined },
        { label: "Avg order value", value: money(aov) },
        { label: "Health score", value: `${score}/100`, hint: grade },
      ],
      narrative: [
        `Over ${periodLabel.toLowerCase() === "all time" ? "all recorded history" : `the period ${periodLabel}`}, the business made ${money(revenue)} in revenue across ${orders} orders${cmp(revGrowth)}, at an average order value of ${money(aov)}.`,
        `Gross profit was ${money(grossProfit)} (${Math.round(grossMargin)}% margin); after ${money(expenseTotal)} in expenses, net profit was ${money(netProfit)}.`,
        `Overall business health scores ${score}/100 (${grade}). ${chanSorted[0] ? `${chanSorted[0][0]} is the leading channel and ${topProducts[0]?.[1].name ?? "your top product"} is the best seller.` : ""}`,
        recommendations[0] ? `Top priority: ${recommendations[0].action.toLowerCase()}.` : "No urgent actions detected.",
      ],
    },
    keyInsights,
    sales: {
      kpis: [
        { label: "Revenue", value: money(revenue), hint: hasComparison ? pct(revGrowth) : undefined },
        { label: "Orders", value: String(orders), hint: hasComparison ? pct(orderGrowth) : undefined },
        { label: "Avg order value", value: money(aov) },
        { label: "Gross margin", value: `${Math.round(grossMargin)}%` },
      ],
      byDay, byPayment,
      narrative: [
        `${orders} completed orders generated ${money(revenue)}${cmp(revGrowth)}.`,
        byPayment[0] ? `${byPayment[0].label} is the most-used payment method (${money(byPayment[0].value)}).` : "",
        byDay.length ? `Daily revenue ${revGrowth >= 0 ? "held up or grew" : "softened"} over the window — see the trend chart.` : "",
      ].filter(Boolean),
    },
    customers: {
      kpis: [
        { label: "Buying customers", value: String(distinctCustomers) },
        { label: "Repeat customers", value: String(repeatCustomers), hint: `${Math.round(repeatRate)}%` },
        { label: "Top customer spend", value: topCustomers[0] ? money(topCustomers[0][1].spend) : "$0" },
      ],
      byType, byCity,
      top: { columns: ["Customer", "Orders", "Spend"], rows: topCustomers.map(([, v]) => [v.name, v.orders, money(v.spend)]) },
      narrative: [
        `${distinctCustomers} distinct customers bought this period; ${Math.round(repeatRate)}% of them ordered more than once.`,
        byType[0] ? `${byType[0].label} customers spent the most (${money(byType[0].value)}).` : "",
        byCity[0] ? `${byCity[0].label} is the top city by revenue.` : "City data is limited — link sales to customer records to unlock city insights.",
      ].filter(Boolean),
    },
    products: {
      topByRevenue, categories, brands, basket, fastMovers, slowMovers,
      narrative: [
        topProducts[0] ? `${topProducts[0][1].name} is the top revenue product (${money(topProducts[0][1].revenue)}).` : "No product sales in this period.",
        categories[0] ? `${categories[0].label} is the strongest category.` : "",
        basket[0] ? `Frequently bought together: ${basket[0].pair} (${basket[0].count} orders) — a clear bundling opportunity.` : "Not enough multi-item orders yet for basket analysis.",
        slow.length ? `${slow.length} in-stock products didn't sell this period (slow movers).` : "",
      ].filter(Boolean),
    },
    shopTime: {
      byHour, byWeekday, peakShift,
      peakHour: `${String(peakHourIdx).padStart(2, "0")}:00`,
      peakDay: DOW[peakDayIdx],
      narrative: [
        `Customers shop most in the ${peakShift.toLowerCase()}, peaking around ${String(peakHourIdx).padStart(2, "0")}:00 (local time).`,
        `${DOW[peakDayIdx]} is the busiest day of the week.`,
        `Schedule promotions, ad boosts and staffing around the ${peakShift.toLowerCase()} and ${DOW[peakDayIdx]} to catch peak demand.`,
      ],
    },
    marketing: {
      byChannel,
      narrative: [
        chanSorted[0] ? `${chanSorted[0][0]} is the best-performing channel (${money(chanSorted[0][1].rev)}, ${chanSorted[0][1].orders} orders).` : "No channel data.",
        chanSorted.length > 1 ? `The weakest active channel is ${chanSorted[chanSorted.length - 1][0]} (${money(chanSorted[chanSorted.length - 1][1].rev)}).` : "",
        "Shift budget toward channels with the best revenue-per-order and away from the weakest.",
      ].filter(Boolean),
    },
    inventory: {
      kpis: [
        { label: "Inventory value", value: money(invValue) },
        { label: "Low stock items", value: String(lowStock.length) },
        { label: "Out of stock", value: String(outOfStock.length) },
      ],
      restock,
      narrative: [
        `Inventory is worth ${money(invValue)} at cost; ${lowStock.length} products are at/below their reorder point and ${outOfStock.length} are out of stock.`,
        outTopSellers.length ? `${outTopSellers.length} of the out-of-stock items are proven sellers — restock first.` : "",
        slow.length ? `${slow.length} products are slow movers tying up capital.` : "",
      ].filter(Boolean),
    },
    freight: {
      kpis: [
        { label: "Shipments", value: String(shipments.length) },
        { label: "Freight cost", value: money(shipments.reduce((s, x) => s + (x.totalCost ?? 0), 0)) },
        { label: "Expected margin", value: money(shipments.reduce((s, x) => s + ((x.expectedSalesValue ?? 0) - (x.totalCost ?? 0)), 0)) },
      ],
      byType: byTypeFreight, forwarders,
      narrative: shipments.length
        ? [
            `${shipments.length} shipments this period (${air.length} air, ${sea.length} sea).`,
            byTypeFreight.rows.length ? `Compare air vs sea on cost and expected margin above to pick the more efficient route per product.` : "",
            forwarders.rows[0] ? `${forwarders.rows[0][0]} is your most-used forwarder/supplier by cost.` : "",
          ].filter(Boolean)
        : ["No shipments recorded in this period."],
    },
    financial: {
      kpis: [
        { label: "Revenue", value: money(revenue) },
        { label: "COGS", value: money(cogs) },
        { label: "Gross profit", value: money(grossProfit), hint: `${Math.round(grossMargin)}%` },
        { label: "Expenses", value: money(expenseTotal) },
        { label: "Net profit", value: money(netProfit), hint: `${Math.round(netMargin)}%` },
      ],
      expensesByCategory,
      narrative: [
        `Revenue ${money(revenue)} − COGS ${money(cogs)} = gross profit ${money(grossProfit)} (${Math.round(grossMargin)}% margin).`,
        `After ${money(expenseTotal)} operating expenses, net profit is ${money(netProfit)} (${Math.round(netMargin)}% net margin).`,
        expensesByCategory[0] ? `Biggest expense category: ${expensesByCategory[0].label} (${money(expensesByCategory[0].value)}).` : "",
      ].filter(Boolean),
    },
    trends: {
      kpis: hasComparison
        ? [
            { label: "Revenue", value: pct(revGrowth), hint: `${money(prevRevenue)} → ${money(revenue)}` },
            { label: "Profit", value: pct(profitGrowth), hint: `${money(prevProfit)} → ${money(grossProfit)}` },
            { label: "Orders", value: pct(orderGrowth), hint: `${prevSales.length} → ${orders}` },
          ]
        : [{ label: "Comparison", value: "N/A", hint: "Pick a dated range to see trends" }],
      narrative: hasComparison
        ? [
            `Versus the previous ${periodLabel.includes("→") ? "equal-length window" : "period"}, revenue is ${pct(revGrowth)}, profit ${pct(profitGrowth)} and orders ${pct(orderGrowth)}.`,
            revGrowth >= 0 && profitGrowth < revGrowth ? "Revenue grew faster than profit — check discounting and cost creep." : "",
            revGrowth < 0 ? "The decline is concentrated in the weakest channel and slow movers — see risks and recommendations." : "Momentum is positive; protect it by keeping top sellers in stock.",
          ].filter(Boolean)
        : ["Select a specific date range (not all-time) to compare against the preceding period."],
    },
    opportunities,
    risks,
    forecast,
    recommendations,
  };

  return report;
}
