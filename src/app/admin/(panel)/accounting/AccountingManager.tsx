"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, DEFAULT_PAYMENT_METHOD } from "@/lib/payment";
import { confirmDialog } from "@/components/admin/ConfirmDialog";

type Day = { date: string; income: number; expenses: number; net: number; salesCount: number };
type Period = {
  start: string; end: string;
  totalIncome: number; totalExpenses: number; netBalance: number;
  salesIncome: number; salesCount: number; otherIncome: number;
  autoExpenses: number; otherExpenses: number;
  openingBalance: number; closingBalance: number;
  days: Day[];
};
type Overview = {
  today: Period; week: Period; month: Period; year: Period;
  currentBalance: number; openDate: string; opening: number;
};
type Entry = {
  _id: string; date: string; description: string;
  type: "income" | "expense" | "adjustment"; amount: number;
  paymentMethod: string; notes: string;
};

type Tab = "daily" | "weekly" | "monthly" | "yearly" | "custom";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Saturday","Sunday","Monday","Tuesday","Wednesday","Thursday","Friday"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseKey(k: string) { return new Date(`${k}T00:00:00`); }
function money(n: number) {
  const v = n ?? 0;
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
// Saturday → Friday week (mirrors the rest of the system).
function startOfWeek(ref: Date) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return d;
}
const inputClass =
  "rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

export default function AccountingManager() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("daily");
  const [ref, setRef] = useState(new Date());
  const [customStart, setCustomStart] = useState(fmt(new Date()));
  const [customEnd, setCustomEnd] = useState(fmt(new Date()));

  const [period, setPeriod] = useState<Period | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected window (start/end keys) from the active tab + reference date.
  function windowKeys(): { start: string; end: string } {
    if (tab === "custom") return { start: customStart, end: customEnd || customStart };
    if (tab === "daily") return { start: fmt(ref), end: fmt(ref) };
    if (tab === "weekly") {
      const ws = startOfWeek(ref);
      return { start: fmt(ws), end: fmt(new Date(ws.getTime() + 6 * 86400000)) };
    }
    if (tab === "monthly") {
      return { start: fmt(new Date(ref.getFullYear(), ref.getMonth(), 1)), end: fmt(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)) };
    }
    return { start: fmt(new Date(ref.getFullYear(), 0, 1)), end: fmt(new Date(ref.getFullYear(), 11, 31)) };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { start, end } = windowKeys();
    try {
      const [sumRes, entRes] = await Promise.all([
        fetch(`/api/accounting?start=${start}&end=${end}`),
        fetch(`/api/accounting/entries?start=${start}&end=${end}`),
      ]);
      if (!sumRes.ok) throw new Error("Failed to load accounting");
      const s = await sumRes.json();
      setPeriod(s.period);
      setOverview(s.overview);
      setEntries(entRes.ok ? await entRes.json() : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ref, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  function shiftRef(dir: number) {
    const d = new Date(ref);
    if (tab === "daily") d.setDate(d.getDate() + dir);
    else if (tab === "weekly") d.setDate(d.getDate() + dir * 7);
    else if (tab === "monthly") d.setMonth(d.getMonth() + dir);
    else if (tab === "yearly") d.setFullYear(d.getFullYear() + dir);
    setRef(d);
  }

  // ── Manual entry form ─────────────────────────────────────────────────────
  const [showEntry, setShowEntry] = useState(false);
  const [eDate, setEDate] = useState(fmt(new Date()));
  const [eDesc, setEDesc] = useState("");
  const [eType, setEType] = useState<"income" | "expense" | "adjustment">("income");
  const [eAmount, setEAmount] = useState("");
  const [ePay, setEPay] = useState<string>(DEFAULT_PAYMENT_METHOD);
  const [eNotes, setENotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveEntry(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: eDate, description: eDesc, type: eType, amount: Number(eAmount) || 0, paymentMethod: ePay, notes: eNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      setShowEntry(false);
      setEDesc(""); setEAmount(""); setENotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    const ok = await confirmDialog("Delete this accounting entry?");
    if (!ok) return;
    await fetch(`/api/accounting/entries/${id}`, { method: "DELETE" });
    await load();
  }

  // ── Business Balance PIN popup ────────────────────────────────────────────
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  async function submitPin(ev: FormEvent) {
    ev.preventDefault();
    setPinBusy(true);
    setPinError(null);
    try {
      const res = await fetch("/api/accounting/balance/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pin }),
      });
      if (res.ok) {
        setShowPin(false);
        setPin("");
        router.push("/admin/accounting/balance"); // unlocked → open the page
        return;
      }
      const body = await res.json().catch(() => ({}));
      setPinError(res.status === 403 ? (body.error ?? "You're not authorized. Ask the CEO to set your PIN.") : "Incorrect PIN.");
    } catch {
      setPinError("Something went wrong. Try again.");
    } finally {
      setPinBusy(false);
    }
  }

  // ── Opening balance ───────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [obAmount, setObAmount] = useState("");
  const [obDate, setObDate] = useState("");
  async function saveOpening(ev: FormEvent) {
    ev.preventDefault();
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountingOpeningBalance: Number(obAmount) || 0, accountingOpeningDate: obDate }),
    });
    setEditOpen(false);
    await load();
  }

  // ── Reports (Excel / PDF of the current period) ───────────────────────────
  function reportRows() {
    if (!period) return [];
    return period.days.map((d) => ({
      Date: d.date, Income: d.income, Expenses: d.expenses, "Net Balance": d.net, Sales: d.salesCount,
    }));
  }
  async function handleExcel() {
    const { exportExcel } = await import("@/lib/export");
    exportExcel(`accounting-${period?.start}_to_${period?.end}`, reportRows());
  }
  async function handlePdf() {
    if (!period) return;
    const res = await fetch("/api/settings");
    const business = res.ok ? await res.json() : { companyName: "SOMART" };
    const { exportPdf } = await import("@/lib/export");
    await exportPdf({
      filename: `accounting-${period.start}_to_${period.end}`,
      title: "Accounting Report",
      subtitle: `${period.start} → ${period.end}`,
      business,
      kpis: [
        ["Total Income", money(period.totalIncome)],
        ["Total Expenses", money(period.totalExpenses)],
        ["Net Balance", money(period.netBalance)],
        ["Closing Balance", money(period.closingBalance)],
      ],
      columns: [
        { header: "Date", key: "Date" },
        { header: "Income", key: "IncomeF", align: "right" },
        { header: "Expenses", key: "ExpensesF", align: "right" },
        { header: "Net Balance", key: "NetF", align: "right" },
        { header: "Sales", key: "Sales", align: "right" },
      ],
      rows: period.days.map((d) => ({
        Date: d.date, Sales: d.salesCount,
        IncomeF: money(d.income), ExpensesF: money(d.expenses), NetF: money(d.net),
      })),
    });
  }

  async function downloadSheet(kind: "weekly" | "cash" | "monthly") {
    const m = await import("@/lib/accountingSheets");
    if (kind === "weekly") await m.downloadWeeklySheet();
    else if (kind === "cash") await m.downloadCashSheet();
    else await m.downloadMonthlySheet();
  }

  const wk = windowKeys();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400">Finance</p>
          <h1 className="mt-1 text-3xl font-semibold">Accounting</h1>
          <p className="mt-1 text-sm text-muted">Your money in and out — automatically from sales &amp; expenses, plus manual entries.</p>
        </div>
        <button type="button" onClick={() => { setShowPin(true); setPin(""); setPinError(null); }} className="cursor-pointer rounded-full border border-red-500/40 bg-red-500/5 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-red-400 transition-colors duration-200 hover:bg-red-500/10">
          🔒 Business Balance
        </button>
      </div>

      {/* Business Balance PIN popup */}
      {showPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPin(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitPin} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
            <h3 className="text-lg font-bold">🔒 Business Balance</h3>
            <p className="mt-1 text-xs text-muted">Enter your Business Balance PIN to continue.</p>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              className={`${inputClass} mt-4 w-full`}
            />
            {pinError && <p className="mt-2 text-sm text-red-500">{pinError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowPin(false)} className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-muted">Cancel</button>
              <button type="submit" disabled={pinBusy} className="cursor-pointer rounded-full bg-gold-bright px-5 py-2 text-sm font-bold text-black disabled:opacity-60">{pinBusy ? "Checking…" : "Unlock"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Overview cards */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <OverviewCard label="Today — Net" value={money(overview?.today.netBalance ?? 0)} sub={`In ${money(overview?.today.totalIncome ?? 0)} · Out ${money(overview?.today.totalExpenses ?? 0)}`} tone={overview?.today.netBalance} onClick={() => { setTab("daily"); setRef(new Date()); }} />
        <OverviewCard label="This Week — Net" value={money(overview?.week.netBalance ?? 0)} sub={`In ${money(overview?.week.totalIncome ?? 0)}`} tone={overview?.week.netBalance} onClick={() => { setTab("weekly"); setRef(new Date()); }} />
        <OverviewCard label="This Month — Net" value={money(overview?.month.netBalance ?? 0)} sub={`In ${money(overview?.month.totalIncome ?? 0)}`} tone={overview?.month.netBalance} onClick={() => { setTab("monthly"); setRef(new Date()); }} />
        <OverviewCard label="This Year — Net" value={money(overview?.year.netBalance ?? 0)} sub={`In ${money(overview?.year.totalIncome ?? 0)}`} tone={overview?.year.netBalance} onClick={() => { setTab("yearly"); setRef(new Date()); }} />
      </div>

      {/* Current balance + opening */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">Current Balance</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{money(overview?.currentBalance ?? 0)}</p>
          <p className="mt-0.5 text-xs text-muted">
            Opening {money(overview?.opening ?? 0)}{overview?.openDate ? ` from ${overview.openDate}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setObAmount(String(overview?.opening ?? 0)); setObDate(overview?.openDate ?? ""); setEditOpen(true); }}
          className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
        >
          Set opening balance
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["daily", "weekly", "monthly", "yearly", "custom"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider capitalize transition-colors duration-200 ${
              tab === t ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"
            }`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleExcel} className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:border-emerald-500 hover:text-emerald-500">⬇ Excel</button>
          <button type="button" onClick={handlePdf} className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:border-gold hover:text-gold">⬇ PDF</button>
          <button type="button" onClick={() => downloadSheet("weekly")} title="Blank weekly accounting sheet — downloads a PDF" className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:border-gold hover:text-gold">⬇ PDF 1</button>
          <button type="button" onClick={() => downloadSheet("cash")} title="Blank weekly daily cash sheet — downloads a PDF" className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:border-gold hover:text-gold">⬇ PDF 2</button>
          <button type="button" onClick={() => downloadSheet("monthly")} title="Blank monthly accounting sheet — downloads a PDF" className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:border-gold hover:text-gold">⬇ PDF 3</button>
        </div>
      </div>

      {/* Period nav / custom range */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {tab === "custom" ? (
          <>
            <input type="date" value={customStart} max={customEnd || undefined} onChange={(e) => setCustomStart(e.target.value)} className={inputClass} />
            <span className="text-muted">→</span>
            <input type="date" value={customEnd} min={customStart || undefined} onChange={(e) => setCustomEnd(e.target.value)} className={inputClass} />
          </>
        ) : (
          <>
            <button type="button" onClick={() => shiftRef(-1)} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-gold hover:text-gold">←</button>
            <span className="min-w-40 text-center text-sm font-semibold">{periodTitle(tab, ref, wk)}</span>
            <button type="button" onClick={() => shiftRef(1)} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-gold hover:text-gold">→</button>
          </>
        )}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>}

      {/* Summary */}
      {period && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          <SummaryStat label="Total Income" value={money(period.totalIncome)} tone={1} />
          <SummaryStat label="Total Expenses" value={money(period.totalExpenses)} tone={-1} />
          <SummaryStat label="Net Balance" value={money(period.netBalance)} tone={period.netBalance >= 0 ? 1 : -1} big />
          <SummaryStat label="Opening Balance" value={money(period.openingBalance)} />
          <SummaryStat label="Closing Balance" value={money(period.closingBalance)} tone={period.closingBalance >= 0 ? 1 : -1} />
          <SummaryStat label="Sales / Other income" value={`${money(period.salesIncome)} · ${money(period.otherIncome)}`} sub={`${period.salesCount} sales`} />
        </div>
      )}

      {/* Period table */}
      {loading ? (
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-surface" />
      ) : period ? (
        <div className="mt-6">{renderTable(tab, period)}</div>
      ) : null}

      {/* Manual entries */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Manual Entries <span className="text-sm font-normal text-muted">(this period)</span></h2>
        <button type="button" onClick={() => { setShowEntry((v) => !v); setEDate(fmt(ref)); }} className="cursor-pointer rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black hover:scale-[1.03]">+ Entry</button>
      </div>
      {showEntry && (
        <form onSubmit={saveEntry} className="mt-3 grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className={inputClass} required />
          <select value={eType} onChange={(e) => setEType(e.target.value as typeof eType)} className={inputClass}>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="adjustment">Adjustment (±)</option>
          </select>
          <input type="number" step="0.01" placeholder="Amount" value={eAmount} onChange={(e) => setEAmount(e.target.value)} className={inputClass} required />
          <input placeholder="Description" value={eDesc} onChange={(e) => setEDesc(e.target.value)} className={`${inputClass} sm:col-span-2`} required />
          <select value={ePay} onChange={(e) => setEPay(e.target.value)} className={inputClass}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </select>
          <input placeholder="Notes (optional)" value={eNotes} onChange={(e) => setENotes(e.target.value)} className={`${inputClass} sm:col-span-2`} />
          <button type="submit" disabled={saving} className="cursor-pointer rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-background disabled:opacity-60">{saving ? "Saving…" : "Save entry"}</button>
        </form>
      )}
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Method</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No manual entries in this period.</td></tr>
            ) : entries.map((en) => (
              <tr key={en._id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-muted">{en.date}</td>
                <td className="px-4 py-3 font-medium">{en.description}</td>
                <td className="px-4 py-3 capitalize"><span className={en.type === "income" ? "text-emerald-500" : en.type === "expense" ? "text-red-500" : "text-amber-500"}>{en.type}</span></td>
                <td className="px-4 py-3 text-muted">{PAYMENT_METHOD_LABELS[en.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? en.paymentMethod}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(en.amount)}</td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={() => deleteEntry(en._id)} className="cursor-pointer text-xs font-semibold text-red-500 hover:underline">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Opening-balance dialog */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={saveOpening} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
            <h3 className="text-lg font-bold">Opening balance</h3>
            <p className="mt-1 text-xs text-muted">Your starting cash position and the date it applies from.</p>
            <label className="mt-4 block text-sm font-semibold">Amount</label>
            <input type="number" step="0.01" value={obAmount} onChange={(e) => setObAmount(e.target.value)} className={`${inputClass} mt-1 w-full`} />
            <label className="mt-3 block text-sm font-semibold">From date</label>
            <input type="date" value={obDate} onChange={(e) => setObDate(e.target.value)} className={`${inputClass} mt-1 w-full`} />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditOpen(false)} className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-muted">Cancel</button>
              <button type="submit" className="cursor-pointer rounded-full bg-gold-bright px-5 py-2 text-sm font-bold text-black">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function periodTitle(tab: Tab, ref: Date, wk: { start: string; end: string }) {
  if (tab === "daily") return ref.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  if (tab === "weekly") return `${wk.start} → ${wk.end}`;
  if (tab === "monthly") return `${MONTHS[ref.getMonth()]} ${ref.getFullYear()}`;
  if (tab === "yearly") return String(ref.getFullYear());
  return `${wk.start} → ${wk.end}`;
}

function renderTable(tab: Tab, period: Period) {
  if (tab === "daily") return null;
  const byDate = new Map(period.days.map((d) => [d.date, d]));

  if (tab === "weekly") {
    const start = parseKey(period.start);
    const rows = WEEKDAYS.map((name, i) => {
      const key = fmt(new Date(start.getTime() + i * 86400000));
      const d = byDate.get(key) ?? { date: key, income: 0, expenses: 0, net: 0, salesCount: 0 };
      return { name, ...d };
    });
    return <PeriodTable head={["Day", "Date", "Income", "Expenses", "Net Balance"]} rows={rows.map((r) => [r.name, r.date, money(r.income), money(r.expenses), r.net])} total={period} />;
  }

  if (tab === "monthly") {
    const y = parseKey(period.start).getFullYear();
    const m = parseKey(period.start).getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const rows = Array.from({ length: daysInMonth }, (_, i) => {
      const key = `${y}-${pad(m + 1)}-${pad(i + 1)}`;
      const d = byDate.get(key) ?? { date: key, income: 0, expenses: 0, net: 0, salesCount: 0 };
      return [String(i + 1), money(d.income), money(d.expenses), d.net] as [string, string, string, number];
    });
    return <PeriodTable head={["Date", "Income", "Expenses", "Net Balance"]} rows={rows} total={period} />;
  }

  // yearly — group days into months
  const y = parseKey(period.start).getFullYear();
  const perMonth = Array.from({ length: 12 }, () => ({ income: 0, expenses: 0, net: 0 }));
  for (const d of period.days) {
    const mi = parseKey(d.date).getMonth();
    perMonth[mi].income += d.income; perMonth[mi].expenses += d.expenses; perMonth[mi].net += d.net;
  }
  const rows = perMonth.map((mm, i) => [`${MONTHS[i]} ${y}`, money(mm.income), money(mm.expenses), Math.round(mm.net * 100) / 100] as [string, string, string, number]);
  return <PeriodTable head={["Month", "Income", "Expenses", "Net Balance"]} rows={rows} total={period} />;
}

function PeriodTable({ head, rows, total }: { head: string[]; rows: (string | number)[][]; total: Period }) {
  const netIdx = head.length - 1;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
          <tr>{head.map((h, i) => <th key={h} className={`px-4 py-3 font-semibold ${i >= head.length - 3 ? "text-right" : ""}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-line last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className={`px-4 py-2.5 ${ci >= head.length - 3 ? "text-right" : ""} ${ci === netIdx ? (Number(c) < 0 ? "font-semibold text-red-500" : Number(c) > 0 ? "font-semibold text-emerald-500" : "text-muted") : ""}`}>
                  {ci === netIdx && typeof c === "number" ? money(c) : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-surface font-bold">
            <td className="px-4 py-3" colSpan={head.length - 3}>Total</td>
            <td className="px-4 py-3 text-right text-emerald-500">{money(total.totalIncome)}</td>
            <td className="px-4 py-3 text-right text-red-500">{money(total.totalExpenses)}</td>
            <td className={`px-4 py-3 text-right ${total.netBalance < 0 ? "text-red-500" : "text-emerald-500"}`}>{money(total.netBalance)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OverviewCard({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: number; onClick?: () => void }) {
  const color = tone == null ? "" : tone < 0 ? "text-red-500" : "text-emerald-500";
  return (
    <button type="button" onClick={onClick} className="glow-card cursor-pointer rounded-2xl border border-line bg-surface p-4 text-left transition-colors duration-200 hover:border-gold/50">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`mt-1.5 text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </button>
  );
}

function SummaryStat({ label, value, sub, tone, big }: { label: string; value: string; sub?: string; tone?: number; big?: boolean }) {
  const color = tone == null ? "" : tone < 0 ? "text-red-500" : "text-emerald-500";
  return (
    <div className={`rounded-2xl border border-line bg-surface p-4 ${big ? "ring-1 ring-gold/30" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`mt-1.5 font-bold ${big ? "text-2xl" : "text-lg"} ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
