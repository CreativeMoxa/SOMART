"use client";

import { useEffect, useMemo, useState } from "react";
import { SOURCE_LABELS, type MarketingSource } from "@/lib/marketing";
import { ExportButtons } from "@/components/admin/TableTools";
import ProfitReport from "./ProfitReport";

type ReportKind = "profit" | "sales" | "invoices" | "marketing" | "expenses" | "customers";

type Sale = {
  _id: string;
  number: string;
  customerName: string;
  items: { name: string; qty: number }[];
  total: number;
  profit: number;
  status?: string;
  source?: string;
  paymentMethod: string;
  createdAt: string;
};
type Invoice = {
  _id: string;
  number: string;
  customerName: string;
  total: number;
  status: string;
  source?: string;
  dueDate?: string;
  createdAt: string;
};
type Expense = {
  _id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
};
type Customer = { _id: string; name: string; phone: string; email?: string; createdAt: string };

const REPORTS: { kind: ReportKind; label: string }[] = [
  { kind: "profit", label: "Profit" },
  { kind: "sales", label: "Sales" },
  { kind: "invoices", label: "Invoices" },
  { kind: "marketing", label: "Marketing" },
  { kind: "expenses", label: "Expenses" },
  { kind: "customers", label: "Customers" },
];

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDay(d: string | Date) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-44 items-end gap-2 overflow-x-auto">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex min-w-8 flex-1 flex-col items-center gap-1.5">
          <span className="text-[9px] font-semibold text-muted">
            {d.value > 0 ? money(d.value) : ""}
          </span>
          <div
            className="w-full rounded-t-lg bg-gold-bright/80 transition-all duration-500"
            style={{ height: `${Math.max((d.value / max) * 120, d.value > 0 ? 6 : 2)}px` }}
          />
          <span className="max-w-16 truncate text-[10px] font-semibold text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const REPORT_KINDS = REPORTS.map((r) => r.kind);

export default function ReportsManager({ initialTab = "" }: { initialTab?: string }) {
  const [kind, setKind] = useState<ReportKind>(
    REPORT_KINDS.includes(initialTab as ReportKind) ? (initialTab as ReportKind) : "profit"
  );
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(toDay(new Date()));
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [business, setBusiness] = useState<{ companyName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, i, e, c, biz] = await Promise.all([
          fetch("/api/sales?limit=5000").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/invoices").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/expenses").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/customers").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
        ]);
        setSales(s);
        setInvoices(i);
        setExpenses(e);
        setCustomers(c);
        if (biz) setBusiness(biz);
      } catch {
        setError("Failed to load report data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inRange = (day: string) => (!from || day >= from) && (!to || day <= to);

  const data = useMemo(() => {
    const fSales = sales.filter((s) => inRange(toDay(s.createdAt)));
    const completed = fSales.filter((s) => s.status !== "pending");
    const fInvoices = invoices.filter((i) => inRange(toDay(i.createdAt)));
    const fExpenses = expenses.filter((e) => inRange(e.date));
    const fCustomers = customers.filter((c) => inRange(toDay(c.createdAt)));
    return { fSales, completed, fInvoices, fExpenses, fCustomers };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, invoices, expenses, customers, from, to]);

  // Per-report shaping: KPIs, chart, table columns + rows
  const report = useMemo(() => {
    const { completed, fInvoices, fExpenses, fCustomers } = data;

    if (kind === "sales") {
      const revenue = completed.reduce((s, x) => s + x.total, 0);
      const profit = completed.reduce((s, x) => s + x.profit, 0);
      const byDay = new Map<string, number>();
      for (const s of completed) {
        const key = toDay(s.createdAt);
        byDay.set(key, (byDay.get(key) ?? 0) + s.total);
      }
      return {
        kpis: [
          ["Completed sales", String(completed.length)],
          ["Revenue", money(revenue)],
          ["Profit", money(profit)],
          ["Avg order", money(completed.length ? revenue / completed.length : 0)],
        ] as [string, string][],
        chart: [...byDay.entries()]
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([label, value]) => ({ label: label.slice(5), value })),
        chartTitle: "Revenue by day",
        columns: ["Number", "Date", "Customer", "Type", "Status", "Total", "Profit"],
        rows: data.fSales.map((s) => ({
          Number: s.number,
          Date: toDay(s.createdAt),
          Customer: s.customerName,
          Type: SOURCE_LABELS[s.source as MarketingSource] ?? "Walk-in",
          Status: s.status ?? "completed",
          Total: money(s.total),
          Profit: money(s.profit),
        })),
      };
    }

    if (kind === "invoices") {
      const paid = fInvoices.filter((i) => i.status === "paid");
      const outstanding = fInvoices.filter((i) => i.status === "unpaid" || i.status === "overdue");
      const byStatus = new Map<string, number>();
      for (const i of fInvoices) byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + i.total);
      return {
        kpis: [
          ["Invoices", String(fInvoices.length)],
          ["Paid value", money(paid.reduce((s, i) => s + i.total, 0))],
          ["Outstanding", money(outstanding.reduce((s, i) => s + i.total, 0))],
          ["Total value", money(fInvoices.reduce((s, i) => s + i.total, 0))],
        ] as [string, string][],
        chart: [...byStatus.entries()].map(([label, value]) => ({ label, value })),
        chartTitle: "Value by status",
        columns: ["Number", "Date", "Customer", "Type", "Status", "Due", "Total"],
        rows: fInvoices.map((i) => ({
          Number: i.number,
          Date: toDay(i.createdAt),
          Customer: i.customerName,
          Type: SOURCE_LABELS[i.source as MarketingSource] ?? "Walk-in",
          Status: i.status,
          Due: i.dueDate || "—",
          Total: money(i.total),
        })),
      };
    }

    if (kind === "marketing") {
      const bySource = new Map<string, { count: number; revenue: number }>();
      for (const s of completed) {
        const key = SOURCE_LABELS[s.source as MarketingSource] ?? "Walk-in";
        const entry = bySource.get(key) ?? { count: 0, revenue: 0 };
        entry.count += 1;
        entry.revenue += s.total;
        bySource.set(key, entry);
      }
      const entries = [...bySource.entries()];
      const totalRevenue = entries.reduce((s, [, v]) => s + v.revenue, 0);
      const top = entries.sort((a, b) => b[1].revenue - a[1].revenue)[0];
      return {
        kpis: [
          ["Revenue", money(totalRevenue)],
          ["Top channel", top?.[0] ?? "—"],
          ["Channels used", String(entries.length)],
        ] as [string, string][],
        chart: entries.map(([label, v]) => ({ label, value: v.revenue })),
        chartTitle: "Revenue by customer type",
        columns: ["Customer type", "Sales", "Revenue", "Share"],
        rows: entries.map(([label, v]) => ({
          "Customer type": label,
          Sales: String(v.count),
          Revenue: money(v.revenue),
          Share: totalRevenue ? `${((v.revenue / totalRevenue) * 100).toFixed(0)}%` : "0%",
        })),
      };
    }

    if (kind === "expenses") {
      const total = fExpenses.reduce((s, e) => s + e.amount, 0);
      const byCategory = new Map<string, number>();
      for (const e of fExpenses)
        byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
      return {
        kpis: [
          ["Records", String(fExpenses.length)],
          ["Total expenses", money(total)],
          [
            "Biggest category",
            [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
          ],
        ] as [string, string][],
        chart: [...byCategory.entries()].map(([label, value]) => ({ label, value })),
        chartTitle: "Spend by category",
        columns: ["Expense", "Category", "Date", "Amount"],
        rows: fExpenses.map((e) => ({
          Expense: e.title,
          Category: e.category,
          Date: e.date,
          Amount: money(e.amount),
        })),
      };
    }

    // customers
    const byDay = new Map<string, number>();
    for (const c of data.fCustomers) {
      const key = toDay(c.createdAt);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return {
      kpis: [
        ["New customers", String(fCustomers.length)],
        ["Total customers", String(customers.length)],
      ] as [string, string][],
      chart: [...byDay.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([label, value]) => ({ label: label.slice(5), value })),
      chartTitle: "New customers by day",
      columns: ["Name", "Phone", "Email", "Added"],
      rows: fCustomers.map((c) => ({
        Name: c.name,
        Phone: c.phone,
        Email: c.email || "—",
        Added: toDay(c.createdAt),
      })),
    };
  }, [kind, data, customers.length]);

  const reportLabel = REPORTS.find((r) => r.kind === kind)?.label ?? "";
  const subtitle = `${from || "…"} → ${to || "…"}`;

  async function handleExcel() {
    setBusy(true);
    try {
      const { exportExcel } = await import("@/lib/export");
      exportExcel(`${kind}-report`, report.rows);
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf() {
    setBusy(true);
    try {
      const { exportPdf } = await import("@/lib/export");
      await exportPdf({
        filename: `${kind}-report`,
        title: `${reportLabel} Report`,
        subtitle,
        business: business ?? { companyName: "SOMART" },
        landscape: report.columns.length > 5,
        kpis: report.kpis,
        columns: report.columns.map((c) => ({
          header: c,
          key: c,
          align: /total|profit|amount|revenue|share|sales$/i.test(c) ? ("right" as const) : undefined,
        })),
        rows: report.rows,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Reports
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Business Reports</h1>
          <p className="mt-1 text-sm text-muted">
            Presentation-ready reports for every module — filter by date, then export.
          </p>
        </div>
        {kind !== "profit" && (
          <ExportButtons onExcel={handleExcel} onPdf={handlePdf} busy={busy || loading} />
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.kind}
            type="button"
            onClick={() => setKind(r.kind)}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
              kind === r.kind
                ? "bg-foreground text-background"
                : "border border-line text-muted hover:border-gold hover:text-gold"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {kind === "profit" ? (
        <div className="mt-6">
          <ProfitReport companyName={business?.companyName ?? "SOMART"} />
        </div>
      ) : (
       <>
      <div className="mt-5 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="r-from" className="text-sm font-semibold">From</label>
          <input
            id="r-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="r-to" className="text-sm font-semibold">To</label>
          <input
            id="r-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </div>
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

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {report.kpis.map(([label, value], i) => (
              <StatCard key={label} label={label} value={value} accent={i === 1 || label === "Revenue"} />
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">{report.chartTitle}</h2>
            {report.chart.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No data in this date range.</p>
            ) : (
              <div className="mt-4">
                <BarChart data={report.chart} />
              </div>
            )}
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-10 px-3 py-3 font-semibold">#</th>
                  {report.columns.map((c) => (
                    <th key={c} className="px-4 py-3 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 text-xs text-muted">{i + 1}</td>
                    {report.columns.map((c) => (
                      <td key={c} className="px-4 py-3">
                        {(row as Record<string, string>)[c]}
                      </td>
                    ))}
                  </tr>
                ))}
                {report.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={report.columns.length + 1}
                      className="px-4 py-12 text-center text-muted"
                    >
                      No data in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
       </>
      )}
    </div>
  );
}
