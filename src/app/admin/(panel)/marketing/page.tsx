import type { Metadata } from "next";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Invoice } from "@/models/Invoice";
import { MARKETING_SOURCES, SOURCE_LABELS } from "@/lib/marketing";
import { getSettings } from "@/models/Setting";
import MarketingExport from "./MarketingExport";

export const metadata: Metadata = { title: "Marketing — Admin" };
export const dynamic = "force-dynamic";

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type SourceRow = {
  source: string;
  label: string;
  monthCount: number;
  monthRevenue: number;
  totalCount: number;
  totalRevenue: number;
  totalProfit: number;
  invoiceCount: number;
};

async function getMarketingData(): Promise<{ rows: SourceRow[]; totalRevenue: number }> {
  await connectDB();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  type Agg = { _id: string | null; count: number; revenue: number; profit: number };
  const [allTime, month, invoices] = await Promise.all([
    Sale.aggregate<Agg>([
      { $match: { status: { $ne: "pending" } } },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
          revenue: { $sum: "$total" },
          profit: { $sum: "$profit" },
        },
      },
    ]),
    Sale.aggregate<Agg>([
      { $match: { createdAt: { $gte: startOfMonth }, status: { $ne: "pending" } } },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
          revenue: { $sum: "$total" },
          profit: { $sum: "$profit" },
        },
      },
    ]),
    Invoice.aggregate<{ _id: string | null; count: number }>([
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]),
  ]);

  const byKey = (rows: Agg[]) =>
    new Map(rows.map((r) => [r._id ?? "walk-in", r]));
  const allMap = byKey(allTime);
  const monthMap = byKey(month);
  const invoiceMap = new Map(invoices.map((r) => [r._id ?? "walk-in", r.count]));

  const rows = MARKETING_SOURCES.map((s) => ({
    source: s,
    label: SOURCE_LABELS[s],
    monthCount: monthMap.get(s)?.count ?? 0,
    monthRevenue: monthMap.get(s)?.revenue ?? 0,
    totalCount: allMap.get(s)?.count ?? 0,
    totalRevenue: allMap.get(s)?.revenue ?? 0,
    totalProfit: allMap.get(s)?.profit ?? 0,
    invoiceCount: invoiceMap.get(s) ?? 0,
  }));

  const totalRevenue = rows.reduce((sum, r) => sum + r.totalRevenue, 0);
  return { rows, totalRevenue };
}

export default async function MarketingPage() {
  const [{ rows, totalRevenue }, settings] = await Promise.all([
    getMarketingData(),
    getSettings(),
  ]);
  const best = [...rows].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Marketing
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Where Customers Come From</h1>
          <p className="mt-1 text-sm text-muted">
            Every sale and invoice records a customer type (Walk-in, Facebook, TikTok, No
            Ads). This report shows which channel actually brings in money.
          </p>
        </div>
        <MarketingExport rows={rows} companyName={settings.companyName || "SOMART"} />
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((r) => {
          const share = totalRevenue > 0 ? (r.totalRevenue / totalRevenue) * 100 : 0;
          return (
            <div key={r.source} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
                  {r.label}
                </p>
                {best && best.source === r.source && best.totalRevenue > 0 && (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
                    Top
                  </span>
                )}
              </div>
              <p className="mt-2 text-2xl font-bold text-gold">{money(r.totalRevenue)}</p>
              <p className="mt-1 text-xs text-muted">
                {r.totalCount} sale{r.totalCount === 1 ? "" : "s"} all time ·{" "}
                {share.toFixed(0)}% of revenue
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-gold-bright/80"
                  style={{ width: `${share}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer type</th>
              <th className="px-4 py-3 font-semibold">Sales (this month)</th>
              <th className="px-4 py-3 font-semibold">Revenue (this month)</th>
              <th className="px-4 py-3 font-semibold">Sales (all time)</th>
              <th className="px-4 py-3 font-semibold">Revenue (all time)</th>
              <th className="px-4 py-3 font-semibold">Profit (all time)</th>
              <th className="px-4 py-3 font-semibold">Invoices</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold">{r.label}</td>
                <td className="px-4 py-3">{r.monthCount}</td>
                <td className="px-4 py-3 font-bold text-gold">{money(r.monthRevenue)}</td>
                <td className="px-4 py-3">{r.totalCount}</td>
                <td className="px-4 py-3 font-bold text-gold">{money(r.totalRevenue)}</td>
                <td className="px-4 py-3 text-emerald-500">{money(r.totalProfit)}</td>
                <td className="px-4 py-3 text-muted">{r.invoiceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        Set the customer type when creating a{" "}
        <Link href="/admin/sales" className="text-gold hover:underline">
          sale
        </Link>
        ,{" "}
        <Link href="/admin/invoices" className="text-gold hover:underline">
          invoice
        </Link>{" "}
        or{" "}
        <Link href="/admin/quotations" className="text-gold hover:underline">
          quotation
        </Link>
        . It is marketing data only and never appears on printed documents.
      </p>
    </div>
  );
}
