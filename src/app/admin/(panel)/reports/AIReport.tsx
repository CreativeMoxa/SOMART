"use client";

import { useState } from "react";
import { startOfWeek } from "@/lib/dateRange";
import type { BIBar, BIInsight, BIRec, BIReport, BITable, BIKpi } from "@/lib/bi/types";

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Preset =
  | "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month"
  | "last-3m" | "last-6m" | "this-year" | "last-year" | "all" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this-week", label: "This week" },
  { key: "last-week", label: "Last week" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "last-3m", label: "Last 3 months" },
  { key: "last-6m", label: "Last 6 months" },
  { key: "this-year", label: "This year" },
  { key: "last-year", label: "Last year" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range" },
];

function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date();
  const t = toKey(today);
  const shiftMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
  switch (p) {
    case "today": return { from: t, to: t };
    case "yesterday": { const d = new Date(); d.setDate(d.getDate() - 1); return { from: toKey(d), to: toKey(d) }; }
    case "this-week": return { from: toKey(startOfWeek(today)), to: t };
    case "last-week": {
      const ws = startOfWeek(today);
      const lwEnd = new Date(ws.getTime() - 86400000);
      const lwStart = new Date(ws.getTime() - 7 * 86400000);
      return { from: toKey(lwStart), to: toKey(lwEnd) };
    }
    case "this-month": return { from: toKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: t };
    case "last-month": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toKey(s), to: toKey(e) };
    }
    case "last-3m": return { from: toKey(shiftMonths(3)), to: t };
    case "last-6m": return { from: toKey(shiftMonths(6)), to: t };
    case "this-year": return { from: toKey(new Date(today.getFullYear(), 0, 1)), to: t };
    case "last-year": return { from: `${today.getFullYear() - 1}-01-01`, to: `${today.getFullYear() - 1}-12-31` };
    case "all": return { from: "", to: "" };
    default: return { from: toKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: t };
  }
}

// ── Small render helpers ─────────────────────────────────────────────────────
const card = "rounded-2xl border border-line bg-surface p-5";
const TONE: Record<string, string> = {
  positive: "border-emerald-500/30 bg-emerald-500/5",
  negative: "border-red-500/30 bg-red-500/5",
  risk: "border-red-500/30 bg-red-500/5",
  opportunity: "border-gold/40 bg-gold/5",
  neutral: "border-line bg-surface",
};

function Kpis({ items }: { items: BIKpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((k, i) => (
        <div key={i} className="rounded-xl border border-line bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{k.label}</p>
          <p className="mt-1 text-lg font-bold">{k.value}</p>
          {k.hint && <p className="text-[11px] text-muted">{k.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function Bars({ data }: { data: BIBar[] }) {
  if (!data.length) return <p className="text-sm text-muted">No data.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={i} className="text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{d.label}</span>
            <span className="text-muted">{d.display ?? d.value}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-gold-bright/80" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Table({ t }: { t: BITable }) {
  if (!t.rows.length) return <p className="text-sm text-muted">No data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>{t.columns.map((c, i) => <th key={i} className="py-2 pr-4">{c}</th>)}</tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => <td key={j} className="py-2 pr-4">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Narrative({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
      {lines.map((l, i) => <li key={i}>• {l}</li>)}
    </ul>
  );
}

function InsightList({ items }: { items: BIInsight[] }) {
  if (!items.length) return <p className="text-sm text-muted">None detected in this period.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((it, i) => (
        <div key={i} className={`rounded-xl border p-3 ${TONE[it.tone] ?? TONE.neutral}`}>
          <p className="text-sm font-bold">{it.title}</p>
          <p className="mt-1 text-sm text-muted">{it.detail}</p>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const PRI: Record<string, string> = {
  High: "bg-red-500/15 text-red-500",
  Medium: "bg-amber-500/15 text-amber-500",
  Low: "bg-slate-500/15 text-slate-400",
};

export default function AIReport({ onClose }: { onClose: () => void }) {
  const [preset, setPreset] = useState<Preset>("this-month");
  const [range, setRange] = useState(() => presetRange("this-month"));
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BIReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  function choose(p: Preset) {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  }

  async function generate() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/reports/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(range),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to generate report");
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    if (!report) return;
    setDownloading(true);
    try {
      const [{ exportBIReportPdf }, biz] = await Promise.all([
        import("@/lib/bi/reportPdf"),
        fetch("/api/settings").then((r) => (r.ok ? r.json() : { companyName: "SOMART" })),
      ]);
      await exportBIReportPdf(report, biz);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">AI Business Intelligence</p>
            <h1 className="mt-1 text-2xl font-bold">Business Intelligence Report</h1>
          </div>
          <div className="flex gap-2">
            {report && (
              <button onClick={download} disabled={downloading}
                className="cursor-pointer rounded-full bg-foreground px-5 py-2 text-xs font-semibold uppercase tracking-wider text-background hover:opacity-90 disabled:opacity-60">
                {downloading ? "Preparing…" : "⬇ Download PDF"}
              </button>
            )}
            <button onClick={onClose} className="cursor-pointer rounded-full border border-line px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted hover:border-gold hover:text-gold">
              Close
            </button>
          </div>
        </div>

        {/* Period picker */}
        <div className={`mt-5 ${card}`}>
          <p className="text-sm font-semibold">Reporting period</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => choose(p.key)}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
                  preset === p.key ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <label className="text-sm font-semibold">From</label>
                <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                  className="mt-1 block rounded-xl border border-line bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-semibold">To</label>
                <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                  className="mt-1 block rounded-xl border border-line bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button onClick={generate} disabled={loading}
              className="cursor-pointer rounded-full bg-gold-bright px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black hover:opacity-90 disabled:opacity-60">
              {loading ? "Analyzing your data…" : "✨ Generate AI Report"}
            </button>
            <span className="text-xs text-muted">
              {preset === "all" ? "All recorded data" : `${range.from || "start"} → ${range.to || "today"}`}
            </span>
          </div>
          {error && <p className="mt-3 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-500">{error}</p>}
        </div>

        {loading && <p className="mt-8 text-center text-sm text-muted">Crunching sales, customers, products, inventory, freight and finances…</p>}

        {report && !loading && (
          <div className="mt-6 space-y-5">
            {/* Health + executive */}
            <section className={`${card} bg-gradient-to-br from-gold/5 to-transparent`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Executive Summary</h2>
                  <p className="text-xs text-muted">{report.meta.company} · {report.meta.periodLabel} · {report.meta.dataPoints} orders analysed</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Business Health</p>
                  <p className="text-3xl font-black text-gold">{report.health.score}<span className="text-lg text-muted">/100</span></p>
                  <p className="text-xs font-semibold">{report.health.grade}</p>
                </div>
              </div>
              <div className="mt-4"><Kpis items={report.executive.kpis} /></div>
              <Narrative lines={report.executive.narrative} />
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {report.health.drivers.map((d, i) => (
                  <div key={i} className="rounded-xl border border-line bg-background p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{d.label}</span>
                      <span className="font-bold text-gold">{d.score}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-gold-bright/80" style={{ width: `${d.score}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{d.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <Section title="Key Business Insights"><InsightList items={report.keyInsights} /></Section>

            <Section title="Sales Analysis">
              <Kpis items={report.sales.kpis} />
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Revenue by day</p><Bars data={report.sales.byDay} /></div>
                <div><p className="mb-2 text-sm font-semibold">By payment method</p><Bars data={report.sales.byPayment} /></div>
              </div>
              <Narrative lines={report.sales.narrative} />
            </Section>

            <Section title="Customer Analysis">
              <Kpis items={report.customers.kpis} />
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">By customer type</p><Bars data={report.customers.byType} /></div>
                <div><p className="mb-2 text-sm font-semibold">Top cities by revenue</p><Bars data={report.customers.byCity} /></div>
              </div>
              <div className="mt-4"><p className="mb-2 text-sm font-semibold">Top customers</p><Table t={report.customers.top} /></div>
              <Narrative lines={report.customers.narrative} />
            </Section>

            <Section title="Product Analysis">
              <p className="mb-2 text-sm font-semibold">Top products by revenue</p>
              <Table t={report.products.topByRevenue} />
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Category performance</p><Bars data={report.products.categories} /></div>
                <div><p className="mb-2 text-sm font-semibold">Brand performance</p><Bars data={report.products.brands} /></div>
              </div>
              {report.products.basket.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold">Frequently bought together</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {report.products.basket.map((b, i) => (
                      <div key={i} className="rounded-xl border border-gold/40 bg-gold/5 p-3 text-sm">
                        <span className="font-semibold">{b.pair}</span>
                        <span className="ml-2 text-xs text-muted">×{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Fast movers</p><Table t={report.products.fastMovers} /></div>
                <div><p className="mb-2 text-sm font-semibold">Slow movers</p><Table t={report.products.slowMovers} /></div>
              </div>
              <Narrative lines={report.products.narrative} />
            </Section>

            <Section title={`Best Shopping Time — peaks in the ${report.shopTime.peakShift}`}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Orders by hour (local)</p><Bars data={report.shopTime.byHour.filter((h) => h.value > 0)} /></div>
                <div><p className="mb-2 text-sm font-semibold">Orders by weekday</p><Bars data={report.shopTime.byWeekday} /></div>
              </div>
              <Narrative lines={report.shopTime.narrative} />
            </Section>

            <Section title="Marketing Performance"><Table t={report.marketing.byChannel} /><Narrative lines={report.marketing.narrative} /></Section>

            <Section title="Inventory Analysis">
              <Kpis items={report.inventory.kpis} />
              <div className="mt-4"><p className="mb-2 text-sm font-semibold">Restock priorities</p><Table t={report.inventory.restock} /></div>
              <Narrative lines={report.inventory.narrative} />
            </Section>

            <Section title="Freight & Logistics">
              <Kpis items={report.freight.kpis} />
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Air vs Sea</p><Table t={report.freight.byType} /></div>
                <div><p className="mb-2 text-sm font-semibold">Forwarders / suppliers</p><Table t={report.freight.forwarders} /></div>
              </div>
              <Narrative lines={report.freight.narrative} />
            </Section>

            <Section title="Financial Performance">
              <Kpis items={report.financial.kpis} />
              {report.financial.expensesByCategory.length > 0 && (
                <div className="mt-4"><p className="mb-2 text-sm font-semibold">Expenses by category</p><Bars data={report.financial.expensesByCategory} /></div>
              )}
              <Narrative lines={report.financial.narrative} />
            </Section>

            <Section title="Trend Analysis"><Kpis items={report.trends.kpis} /><Narrative lines={report.trends.narrative} /></Section>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Opportunities"><InsightList items={report.opportunities} /></Section>
              <Section title="Risks"><InsightList items={report.risks} /></Section>
            </div>

            {report.forecast && (
              <Section title="Forecasts & Predictions"><Kpis items={report.forecast.kpis} /><Narrative lines={report.forecast.narrative} /></Section>
            )}

            <Section title="Actionable Recommendations">
              {report.recommendations.length === 0 ? (
                <p className="text-sm text-muted">No pressing actions — keep doing what works.</p>
              ) : (
                <ol className="space-y-2">
                  {report.recommendations.map((r: BIRec, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-xl border border-line bg-background p-3">
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PRI[r.priority]}`}>{r.priority}</span>
                      <div>
                        <p className="text-sm font-semibold">{r.action}</p>
                        <p className="text-xs text-muted">{r.reason}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <p className="pb-8 text-center text-xs text-muted">
              Generated from your live business data on {new Date(report.meta.generatedAt).toLocaleString("en-US")}. Every figure is computed from real records.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
