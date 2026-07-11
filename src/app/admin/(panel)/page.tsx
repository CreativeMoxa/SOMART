import type { Metadata } from "next";
import Link from "next/link";
import { getDashboardMetrics } from "@/lib/metrics";

export const metadata: Metadata = { title: "Admin Dashboard" };
export const dynamic = "force-dynamic";

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-semibold text-muted">
            {d.total > 0 ? money(d.total) : ""}
          </span>
          <div
            className="w-full rounded-t-lg bg-gold-bright/80 transition-all duration-500"
            style={{ height: `${Math.max((d.total / max) * 130, d.total > 0 ? 8 : 2)}px` }}
          />
          <span className="text-xs font-semibold text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const m = await getDashboardMetrics();

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">Admin</p>
      <h1 className="mt-1 text-3xl font-semibold">Dashboard</h1>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={money(m.todaySales)} accent />
        <StatCard label="Monthly Revenue" value={money(m.monthRevenue)} />
        <StatCard label="Annual Revenue" value={money(m.yearRevenue)} />
        <StatCard label="Gross Profit (month)" value={money(m.monthProfit)} />
        <StatCard label="Expenses (month)" value={money(m.monthExpenses)} />
        <StatCard
          label="Net Profit (month)"
          value={money(m.netProfit)}
          accent={m.netProfit > 0}
        />
        <StatCard label="Inventory Value" value={money(m.inventoryValue)} />
        <StatCard label="Unpaid Invoices" value={String(m.unpaidInvoices)} />
        <StatCard label="Total Orders" value={String(m.totalOrders)} />
        <StatCard label="Total Customers" value={String(m.totalCustomers)} />
        <StatCard label="Products" value={String(m.totalProducts)} />
        <StatCard label="Low Stock Items" value={String(m.lowStock.length)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Sales — Last 7 Days</h2>
          <div className="mt-4">
            <BarChart data={m.last7Days} />
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
