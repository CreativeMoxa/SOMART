import type { Metadata } from "next";
import Link from "next/link";
import { getDashboardMetrics } from "@/lib/metrics";
import WeeklySalesChart from "./WeeklySalesChart";

export const metadata: Metadata = { title: "Admin Dashboard" };
export const dynamic = "force-dynamic";

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-gold" : ""}`}>{value}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="glow-card group block cursor-pointer rounded-2xl border border-line bg-surface p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {inner}
      </Link>
    );
  }
  return <div className="rounded-2xl border border-line bg-surface p-5">{inner}</div>;
}

export default async function AdminDashboardPage() {
  const m = await getDashboardMetrics();

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">Admin</p>
      <h1 className="mt-1 text-3xl font-semibold">Dashboard</h1>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={money(m.todaySales)} accent href="/admin/sales?range=today" />
        <StatCard label="Today's Revenue" value={money(m.todaySales)} accent href="/admin/sales?range=today" />
        <StatCard label="Today's Profit" value={money(m.todayProfit)} accent href="/admin/reports?tab=profit&range=today" />
        <StatCard label="This Week Revenue" value={money(m.weekRevenue)} href="/admin/sales?range=week" />
        <StatCard label="This Week Profit" value={money(m.weekProfit)} accent href="/admin/reports?tab=profit&range=week" />
        <StatCard label="Monthly Revenue" value={money(m.monthRevenue)} href="/admin/sales?range=month" />
        <StatCard label="Last Month Revenue" value={money(m.lastMonthRevenue)} />
        <StatCard label="Annual Revenue" value={money(m.yearRevenue)} href="/admin/sales?range=year" />
        <StatCard label="Gross Profit (month)" value={money(m.monthProfit)} href="/admin/reports?tab=profit&range=month" />
        <StatCard label="Last Month Profit" value={money(m.lastMonthProfit)} />
        <StatCard label="Annual Profit" value={money(m.yearProfit)} accent href="/admin/reports?tab=profit&range=year" />
        <StatCard label="Expenses (month)" value={money(m.monthExpenses)} href="/admin/expenses?range=month" />
        <StatCard
          label="Net Profit (month)"
          value={money(m.netProfit)}
          accent={m.netProfit > 0}
          href="/admin/reports?tab=profit&range=month"
        />
        <StatCard
          label="Annual Net Profit"
          value={money(m.yearNetProfit)}
          accent={m.yearNetProfit > 0}
          href="/admin/reports?tab=profit&range=year"
        />
        <StatCard label="Inventory Value" value={money(m.inventoryValue)} href="/admin/products" />
        <StatCard label="Unpaid Invoices" value={String(m.unpaidInvoices)} href="/admin/invoices?status=unpaid" />
        <StatCard label="Partial Invoices" value={String(m.partialInvoices)} accent href="/admin/invoices?status=partial" />
        <StatCard label="Today's Orders" value={String(m.todayOrders)} accent href="/admin/sales?range=today" />
        <StatCard label="This Week Orders" value={String(m.weekOrders)} href="/admin/sales?range=week" />
        <StatCard label="Last Week Orders" value={String(m.lastWeekOrders)} />
        <StatCard label="Monthly Orders" value={String(m.monthOrders)} href="/admin/sales?range=month" />
        <StatCard label="All-time Orders" value={String(m.totalOrders)} href="/admin/sales" />
        <StatCard label="Total Customers" value={String(m.totalCustomers)} href="/admin/customers" />
        <StatCard label="Products" value={String(m.totalProducts)} href="/admin/products" />
        <StatCard label="Low Stock Items" value={String(m.lowStock.length)} href="/admin/products?filter=low-stock" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Sales by Day</h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Swipe ← → to browse
            </span>
          </div>
          <div className="mt-4">
            <WeeklySalesChart series={m.dailySeries} />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Web Viewers</h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
              Storefront page views
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Last week", value: m.webViews.week },
              { label: "Last month", value: m.webViews.month },
              { label: "Last year", value: m.webViews.year },
              { label: "All time", value: m.webViews.all },
            ].map((v) => (
              <div key={v.label} className="rounded-xl border border-line bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {v.label}
                </p>
                <p className="mt-1.5 text-2xl font-bold text-gold">
                  {v.value.toLocaleString("en-US")}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Recent Sales</h2>
          {m.recentSales.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No sales recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {m.recentSales.map((sale) => (
                <li key={sale._id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-semibold">{sale.number}</p>
                    <p className="text-xs text-muted">
                      {sale.customerName} ·{" "}
                      {new Date(sale.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="font-bold text-gold">{money(sale.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/sales"
            className="mt-3 inline-block cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-gold hover:underline"
          >
            View all sales →
          </Link>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Top Selling Products</h2>
          {m.topProducts.every((p) => p.soldCount === 0) ? (
            <p className="mt-4 text-sm text-muted">No sales data yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {m.topProducts.map((p, i) => (
                <li key={p.slug} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-semibold">
                    <span className="mr-2 text-gold">#{i + 1}</span>
                    {p.name}
                  </span>
                  <span className="text-muted">{p.soldCount} sold</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Marketing — Where Customers Come From</h2>
          {m.marketing.every((s) => s.monthCount === 0) ? (
            <p className="mt-4 text-sm text-muted">No sales recorded this month yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {m.marketing.map((s) => {
                const maxRevenue = Math.max(...m.marketing.map((x) => x.monthRevenue), 1);
                return (
                  <li key={s.source} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{s.label}</span>
                      <span className="text-muted">
                        {s.monthCount} sale{s.monthCount === 1 ? "" : "s"} ·{" "}
                        <span className="font-bold text-gold">{money(s.monthRevenue)}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-gold-bright/80"
                        style={{ width: `${(s.monthRevenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/admin/marketing"
            className="mt-4 inline-block cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-gold hover:underline"
          >
            View marketing report →
          </Link>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Low Stock Alerts</h2>
          {m.lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-muted">All products are well stocked.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {m.lowStock.map((p) => (
                <li key={p.slug} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      p.stockQty === 0
                        ? "bg-red-500/15 text-red-500"
                        : "bg-amber-500/15 text-amber-500"
                    }`}
                  >
                    {p.stockQty === 0 ? "Out of stock" : `${p.stockQty} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/products"
            className="mt-3 inline-block cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-gold hover:underline"
          >
            Manage inventory →
          </Link>
        </div>
      </div>
    </div>
  );
}
