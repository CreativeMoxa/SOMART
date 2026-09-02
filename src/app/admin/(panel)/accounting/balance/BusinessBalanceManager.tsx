"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { confirmDialog } from "@/components/admin/ConfirmDialog";

const METHODS: [string, string][] = [
  ["zaad", "ZAAD $"],
  ["slcash", "SL CASH"],
  ["edahab", "EDAHAB"],
  ["ebirr", "EBIRR"],
  ["premier", "PREMIER WALLET"],
];

type Obligation = { _id: string; description: string; amount: number; date: string; reason: string; status: "unpaid" | "paid" };
type Log = { _id: string; method: string; previousAmount: number; newAmount: number; adjustment: number; by: string; createdAt: string };
type Data = {
  balance: Record<string, number>;
  total: number;
  obligations: Obligation[];
  totalOwed: number;
  netPosition: number;
  logs: Log[];
};

function money(n: number) {
  const v = n ?? 0;
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const inputClass =
  "rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

export default function BusinessBalanceManager() {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/accounting/balance");
    if (res.status === 403) { setLocked(true); return; }
    if (res.ok) { setData(await res.json()); setLocked(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/accounting/balance/unlock", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pin }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Incorrect PIN");
      setPin("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect PIN");
    } finally { setBusy(false); }
  }

  async function lock() {
    await fetch("/api/accounting/balance/unlock", { method: "DELETE" });
    setData(null); setLocked(true);
  }

  // ── Balance edit ──
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setAmounts(Object.fromEntries(METHODS.map(([k]) => [k, String(data.balance[k] ?? 0)])));
  }, [data]);
  async function saveBalance(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/accounting/balance", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amounts: Object.fromEntries(METHODS.map(([k]) => [k, Number(amounts[k]) || 0])) }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setBusy(false); }
  }

  // ── Obligations ──
  const [oDesc, setODesc] = useState(""); const [oAmount, setOAmount] = useState("");
  const [oReason, setOReason] = useState(""); const [oDate, setODate] = useState("");
  async function addObligation(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/obligations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: oDesc, amount: Number(oAmount) || 0, reason: oReason, date: oDate }),
      });
      if (res.ok) { setODesc(""); setOAmount(""); setOReason(""); setODate(""); await load(); }
    } finally { setBusy(false); }
  }
  async function toggleObligation(o: Obligation) {
    await fetch(`/api/accounting/obligations/${o._id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: o.status === "unpaid" ? "paid" : "unpaid" }),
    });
    await load();
  }
  async function deleteObligation(id: string) {
    if (!(await confirmDialog("Delete this obligation?"))) return;
    await fetch(`/api/accounting/obligations/${id}`, { method: "DELETE" });
    await load();
  }

  // ── PIN screen ──
  if (locked === null) return <div className="mt-10 h-32 animate-pulse rounded-2xl bg-surface" />;
  if (locked) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">🔒 Business Balance</h1>
          <Link href="/admin/accounting" className="text-xs font-semibold text-muted hover:text-gold">← Accounting</Link>
        </div>
        <form onSubmit={unlock} className="rounded-2xl border border-line bg-surface p-6">
          <p className="text-sm text-muted">Enter your account password (PIN) to view the business balance.</p>
          <input
            type="password" autoFocus value={pin} onChange={(e) => setPin(e.target.value)}
            placeholder="PIN / password" className={`${inputClass} mt-4 w-full`} />
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={busy} className="mt-4 w-full cursor-pointer rounded-xl bg-gold-bright px-5 py-3 text-sm font-bold uppercase tracking-wider text-black disabled:opacity-60">
            {busy ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-400">Owner only</p>
          <h1 className="mt-1 text-3xl font-semibold">🔓 Business Balance</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/accounting" className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted hover:border-gold hover:text-gold">← Accounting</Link>
          <button type="button" onClick={lock} className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted hover:border-red-500 hover:text-red-500">Lock</button>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>}

      {/* Position summary */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">Total Business Balance</p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-400">{money(data?.total ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">Money Owed (unpaid)</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-400">{money(data?.totalOwed ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 ring-1 ring-gold/30">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">Net Business Position</p>
          <p className={`mt-1.5 text-2xl font-bold ${(data?.netPosition ?? 0) < 0 ? "text-red-500" : "text-gold"}`}>{money(data?.netPosition ?? 0)}</p>
        </div>
      </div>

      {/* Money available by method */}
      <form onSubmit={saveBalance} className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Money Available</h2>
        <p className="mt-1 text-xs text-muted">Enter the actual amount currently held in each channel.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {METHODS.map(([k, label]) => (
            <label key={k} className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
              <input type="number" step="0.01" value={amounts[k] ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [k]: e.target.value }))} className={`${inputClass} mt-1 w-full`} />
            </label>
          ))}
        </div>
        <button type="submit" disabled={busy} className="mt-4 cursor-pointer rounded-full bg-gold-bright px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-black disabled:opacity-60">
          {busy ? "Saving…" : "Save balance"}
        </button>
      </form>

      {/* Obligations */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Business Money Owed</h2>
        <p className="mt-1 text-xs text-muted">Money the business owes that isn&apos;t a customer sale/invoice. Only unpaid items count against the balance.</p>
        <form onSubmit={addObligation} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input placeholder="Person / description" value={oDesc} onChange={(e) => setODesc(e.target.value)} className={`${inputClass} lg:col-span-2`} required />
          <input type="number" step="0.01" placeholder="Amount" value={oAmount} onChange={(e) => setOAmount(e.target.value)} className={inputClass} required />
          <input placeholder="Reason" value={oReason} onChange={(e) => setOReason(e.target.value)} className={inputClass} />
          <button type="submit" disabled={busy} className="cursor-pointer rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background disabled:opacity-60">Add</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">Person / Description</th>
                <th className="py-2 pr-3 font-semibold">Reason</th>
                <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(data?.obligations ?? []).length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-muted">No obligations recorded.</td></tr>
              ) : data!.obligations.map((o) => (
                <tr key={o._id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{o.description}</td>
                  <td className="py-2.5 pr-3 text-muted">{o.reason || "—"}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold">{money(o.amount)}</td>
                  <td className="py-2.5 pr-3">
                    <button type="button" onClick={() => toggleObligation(o)} className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-bold ${o.status === "unpaid" ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"}`}>
                      {o.status}
                    </button>
                  </td>
                  <td className="py-2.5 text-right"><button type="button" onClick={() => deleteObligation(o._id)} className="cursor-pointer text-xs font-semibold text-red-500 hover:underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit log */}
      {data && data.logs.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Balance Change History</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {data.logs.map((l) => (
              <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-muted">
                  <span className="font-semibold uppercase text-foreground">{l.method}</span> {money(l.previousAmount)} → {money(l.newAmount)}
                  <span className={l.adjustment < 0 ? "text-red-500" : "text-emerald-500"}> ({l.adjustment >= 0 ? "+" : ""}{money(l.adjustment)})</span>
                </span>
                <span className="text-xs text-muted">{l.by} · {new Date(l.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
