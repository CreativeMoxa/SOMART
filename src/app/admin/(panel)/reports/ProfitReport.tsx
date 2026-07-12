"use client";

import { useCallback, useEffect, useState } from "react";
import { SOURCE_LABELS, type MarketingSource } from "@/lib/marketing";
import { CUSTOMER_TYPE_LABELS, type CustomerType } from "@/lib/customerType";
import { ExportButtons } from "@/components/admin/TableTools";

type Row = {
  key: string;
  revenue: number;
  cost: number;
  profit: number;
  qty: number;
  count: number;
  marginPercent: number;
  markupPercent: number;
};

type ProfitData = {
  kpis: {
    revenue: number;
    cost: number;
    profit: number;
    count: number;
    avgMarginPercent: number;
    avgMarkupPercent: number;
  };
  byProduct: Row[];
  byCategory: Row[];
  byBrand: Row[];
  bySource: Row[];
  byCustomerType: Row[];
  timeseries: { bucket: string; revenue: number; cost: number; profit: number }[];
};

type Dimension = "byProduct" | "byCategory" | "byBrand" | "bySource" | "byCustomerType";
type Granularity = "day" | "week" | "month" | "year";

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "byProduct", label: "Product" },
  { key: "byCategory", label: "Category" },
  { key: "byBrand", label: "Brand" },
  { key: "bySource", label: "Marketing Source" },
  { key: "byCustomerType", label: "Customer Type" },
];

const GRANULARITIES: Granularity[] = ["day", "week", "month", "year"];

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Monday of the current week (matches the Sales/dashboard week convention).
function firstOfWeek() {
  const d = new Date();
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toDay(d);
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

// Profit + revenue bars sharing one scale, so cost is readable as the gap.
function ProfitChart({
  data,
}: {
  data: { bucket: string; revenue: number; profit: number }[];
}) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex h-52 items-end gap-2 overflow-x-auto">
      {data.map((d) => (
        <div key={d.bucket} className="flex min-w-10 flex-1 flex-col items-center gap-1">
          <span className="text-[9px] font-semibold text-emerald-500">
            {d.profit > 0 ? money(d.profit) : ""}
          </span>
          <div className="flex h-32 w-full items-end justify-center gap-0.5">
            <div
              className="w-1/2 rounded-t bg-gold-bright/40"
              style={{ height: `${Math.max((d.revenue / max) * 128, 2)}px` }}
              title={`Revenue ${money(d.revenue)}`}
            />
            <div
              className="w-1/2 rounded-t bg-emerald-500/80"
              style={{ height: `${Math.max((d.profit / max) * 128, d.profit > 0 ? 4 : 1)}px` }}
              title={`Profit ${money(d.profit)}`}
            />
          </div>
          <span className="max-w-16 truncate text-[10px] font-semibold text-muted">
            {d.bucket.slice(5) || d.bucket}
          </span>
        </div>
      ))}
    </div>
  );
}

function labelFor(dim: Dimension, key: string) {
  if (dim === "bySource") return SOURCE_LABELS[key as MarketingSource] ?? key;
  if (dim === "byCustomerType") return CUSTOMER_TYPE_LABELS[key as CustomerType] ?? key;
  return key;
}

export default function ProfitReport({ companyName }: { companyName: string }) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(toDay(new Date()));
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [dimension, setDimension] = useState<Dimension>("byProduct");
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ granularity });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/reports/profit?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load profit report");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [from, to, granularity]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.[dimension] ?? [];
  const dimLabel = DIMENSIONS.find((d) => d.key === dimension)?.label ?? "";

  function exportRows() {
    return rows.map((r) => ({
      [dimLabel]: labelFor(dimension, r.key),
      Revenue: r.revenue,
      Cost: r.cost,
      Profit: r.profit,
      "Margin %": r.marginPercent,
      "Markup %": r.markupPercent,
      Qty: r.qty || r.count,
    }));
  }

  async function handleExcel() {
    setBusy(true);
    try {
      const { exportExcel } = await import("@/lib/export");
      exportExcel(`profit-by-${dimension}`, exportRows());
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf() {
    setBusy(true);
    try {
      const { exportPdf } = await import("@/lib/export");
      const k = data?.kpis;
      await exportPdf({
        filename: `profit-by-${dimension}`,
        title: "Profit Report",
        subtitle: `By ${dimLabel} · ${from || "…"} → ${to || "…"}`,
        business: { companyName },
        landscape: true,
        kpis: k
          ? [
              ["Revenue", money(k.revenue)],
              ["Cost", money(k.cost)],
              ["Gross profit", money(k.profit)],
              ["Avg margin", `${k.avgMarginPercent}%`],
              ["Avg markup", `${k.avgMarkupPercent}%`],
            ]
          : [],
        columns: [
          { header: dimLabel, key: dimLabel },
          { header: "Revenue", key: "RevenueFmt", align: "right" },
          { header: "Cost", key: "CostFmt", align: "right" },
          { header: "Profit", key: "ProfitFmt", align: "right" },
          { header: "Margin %", key: "Margin %", align: "right" },
          { header: "Markup %", key: "Markup %", align: "right" },
        ],
        rows: exportRows().map((r) => ({
          ...r,
          RevenueFmt: money(Number(r.Revenue)),
          CostFmt: money(Number(r.Cost)),
          ProfitFmt: money(Number(r.Profit)),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const k = data?.kpis;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="pf-from" className="text-sm font-semibold">From</label>
            <input id="pf-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="pf-to" className="text-sm font-semibold">To</label>
            <input id="pf-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          <button
            type="button"
            onClick={() => {
              setFrom(firstOfWeek());
              setTo(toDay(new Date()));
            }}
            className="cursor-pointer rounded-full border border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom(firstOfMonth());
              setTo(toDay(new Date()));
            }}
            className="cursor-pointer rounded-full border border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo(toDay(new Date()));
            }}
            className="cursor-pointer rounded-full border border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
          >
            All time
          </button>
        </div>
        <ExportButtons onExcel={handleExcel} onPdf={handlePdf} busy={busy || loading} />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total Revenue" value={money(k?.revenue ?? 0)} />
            <StatCard label="Total Cost" value={money(k?.cost ?? 0)} />
            <StatCard label="Gross Profit" value={money(k?.profit ?? 0)} accent />
            <StatCard label="Avg Profit Margin" value={`${k?.avgMarginPercent ?? 0}%`} />
            <StatCard label="Avg Markup" value={`${k?.avgMarkupPercent ?? 0}%`} />
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Profit over time</h2>
              <div className="flex gap-1.5">
                {GRANULARITIES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGranularity(g)}
                    className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
                      granularity === g
                        ? "bg-foreground text-background"
                        : "border border-line text-muted hover:border-gold hover:text-gold"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            {!data || data.timeseries.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No sales in this date range.</p>
            ) : (
              <div className="mt-4">
                <ProfitChart data={data.timeseries} />
                <div className="mt-3 flex gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gold-bright/40" /> Revenue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/80" /> Profit
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {DIMENSIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDimension(d.key)}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
                  dimension === d.key
                    ? "bg-foreground text-background"
                    : "border border-line text-muted hover:border-gold hover:text-gold"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-10 px-3 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">{dimLabel}</th>
                  <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Profit</th>
                  <th className="px-4 py-3 text-right font-semibold">Margin %</th>
                  <th className="px-4 py-3 text-right font-semibold">Markup %</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 text-xs text-muted">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{labelFor(dimension, r.key)}</td>
                    <td className="px-4 py-3 text-right">{money(r.revenue)}</td>
                    <td className="px-4 py-3 text-right text-muted">{money(r.cost)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-500">{money(r.profit)}</td>
                    <td className="px-4 py-3 text-right">{r.marginPercent}%</td>
                    <td className="px-4 py-3 text-right">{r.markupPercent}%</td>
                    <td className="px-4 py-3 text-right text-muted">{r.qty || r.count}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted">
                      No data in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
