import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Expense } from "@/models/Expense";
import { AccountingEntry } from "@/models/AccountingEntry";
import { getSettings } from "@/models/Setting";
import { round2 } from "@/lib/profit";

// ── Accounting aggregation ────────────────────────────────────────────────
// Income  = completed Sales (a paid invoice already becomes a completed Sale,
//           so invoices are NOT counted again) + manual "income" entries +
//           positive "adjustment" entries.
// Expenses = Expenses module + manual "expense" entries + |negative adjustments|.
// Net      = Income − Expenses. Nothing pending/unpaid/cancelled is counted.

export function dayKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(`${d}T00:00:00`) : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

type DayAgg = {
  salesIncome: number;
  salesCount: number;
  manualIncome: number;
  autoExpenses: number;
  manualExpense: number;
  adjPos: number;
  adjNeg: number;
};

function emptyAgg(): DayAgg {
  return { salesIncome: 0, salesCount: 0, manualIncome: 0, autoExpenses: 0, manualExpense: 0, adjPos: 0, adjNeg: 0 };
}

export type DaySummary = {
  date: string;
  income: number;
  expenses: number;
  net: number;
  salesCount: number;
};

export type PeriodSummary = {
  start: string;
  end: string;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  salesIncome: number;
  salesCount: number;
  otherIncome: number; // manual income + positive adjustments
  autoExpenses: number;
  otherExpenses: number; // manual expense + |negative adjustments|
  openingBalance: number;
  closingBalance: number;
  days: DaySummary[];
};

export type AccountingData = {
  byDay: Map<string, DayAgg>;
  opening: number;
  openDate: string; // "" if not set
};

// Load every accounting-relevant record once and bucket it by local day.
export async function loadAccountingData(): Promise<AccountingData> {
  await connectDB();
  const [sales, expenses, entries, settings] = await Promise.all([
    Sale.find({ status: "completed" }).select("total createdAt").batchSize(10000).lean(),
    Expense.find().select("amount date").batchSize(10000).lean(),
    AccountingEntry.find().select("type amount date").batchSize(10000).lean(),
    getSettings(),
  ]);

  const byDay = new Map<string, DayAgg>();
  const at = (k: string) => {
    let a = byDay.get(k);
    if (!a) { a = emptyAgg(); byDay.set(k, a); }
    return a;
  };

  for (const s of sales) {
    const a = at(dayKey(new Date(s.createdAt)));
    a.salesIncome += s.total ?? 0;
    a.salesCount += 1;
  }
  for (const e of expenses) {
    if (!e.date) continue;
    at(String(e.date)).autoExpenses += e.amount ?? 0;
  }
  for (const en of entries) {
    if (!en.date) continue;
    const a = at(String(en.date));
    if (en.type === "income") a.manualIncome += en.amount ?? 0;
    else if (en.type === "expense") a.manualExpense += en.amount ?? 0;
    else {
      const v = en.amount ?? 0;
      if (v >= 0) a.adjPos += v;
      else a.adjNeg += -v;
    }
  }

  return {
    byDay,
    opening: settings.accountingOpeningBalance ?? 0,
    openDate: settings.accountingOpeningDate || "",
  };
}

function dayIncome(a: DayAgg) {
  return a.salesIncome + a.manualIncome + a.adjPos;
}
function dayExpenses(a: DayAgg) {
  return a.autoExpenses + a.manualExpense + a.adjNeg;
}

// Balance at the START of `beforeKey` (exclusive): opening + net of every day
// from openDate up to, but not including, that day.
export function balanceAsOf(data: AccountingData, beforeKey: string): number {
  let net = 0;
  for (const [k, a] of data.byDay) {
    if (data.openDate && k < data.openDate) continue;
    if (k >= beforeKey) continue;
    net += dayIncome(a) - dayExpenses(a);
  }
  return round2(data.opening + net);
}

// Summarize an inclusive [startKey, endKey] window (YYYY-MM-DD strings).
export function summarize(data: AccountingData, startKey: string, endKey: string): PeriodSummary {
  let salesIncome = 0, salesCount = 0, manualIncome = 0, autoExpenses = 0, manualExpense = 0, adjPos = 0, adjNeg = 0;
  const days: DaySummary[] = [];

  for (const [k, a] of data.byDay) {
    if (k < startKey || k > endKey) continue;
    salesIncome += a.salesIncome;
    salesCount += a.salesCount;
    manualIncome += a.manualIncome;
    autoExpenses += a.autoExpenses;
    manualExpense += a.manualExpense;
    adjPos += a.adjPos;
    adjNeg += a.adjNeg;
    const income = dayIncome(a);
    const expenses = dayExpenses(a);
    days.push({ date: k, income: round2(income), expenses: round2(expenses), net: round2(income - expenses), salesCount: a.salesCount });
  }
  days.sort((x, y) => x.date.localeCompare(y.date));

  const totalIncome = round2(salesIncome + manualIncome + adjPos);
  const totalExpenses = round2(autoExpenses + manualExpense + adjNeg);
  const netBalance = round2(totalIncome - totalExpenses);
  const openingBalance = balanceAsOf(data, startKey);

  return {
    start: startKey,
    end: endKey,
    totalIncome,
    totalExpenses,
    netBalance,
    salesIncome: round2(salesIncome),
    salesCount,
    otherIncome: round2(manualIncome + adjPos),
    autoExpenses: round2(autoExpenses),
    otherExpenses: round2(manualExpense + adjNeg),
    openingBalance,
    closingBalance: round2(openingBalance + netBalance),
    days,
  };
}
