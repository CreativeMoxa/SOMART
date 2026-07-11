"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/icons";
import { useSelection, BulkBar, ExportButtons, checkboxClass } from "@/components/admin/TableTools";

type Expense = {
  _id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  notes: string;
};

const categories = [
  "rent",
  "salaries",
  "utilities",
  "marketing",
  "purchases",
  "transport",
  "other",
];

const emptyForm = { title: "", category: "other", amount: "", date: "", notes: "" };
type FormState = typeof emptyForm;

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

export default function ExpensesManager() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { selected, toggle, toggleAll, clear } = useSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error("Failed to load expenses");
      setExpenses(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setEditing("");
    setError(null);
  }

  function openEdit(expense: Expense) {
    setForm({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date,
      notes: expense.notes ?? "",
    });
    setEditing(expense._id);
    setError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isNew = editing === "";
      const res = await fetch(isNew ? "/api/expenses" : `/api/expenses/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) || 0 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setEditing(null);
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expense: Expense) {
    if (!confirm(`Delete expense "${expense.title}"?`)) return;
    try {
      const res = await fetch(`/api/expenses/${expense._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      setExpenses((list) => list.filter((x) => x._id !== expense._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const total = expenses.reduce((sum, x) => sum + x.amount, 0);

  function exportRows() {
    return expenses.map((x) => ({
      Title: x.title,
      Category: x.category,
      Date: x.date,
      Amount: x.amount,
      Notes: x.notes ?? "",
    }));
  }

  async function handleExportExcel() {
    const { exportExcel } = await import("@/lib/export");
    exportExcel("expenses", exportRows());
  }

  async function handleExportPdf() {
    setError(null);
    try {
      const res = await fetch("/api/settings");
      const business = res.ok ? await res.json() : { companyName: "SOMART" };
      const { exportPdf } = await import("@/lib/export");
      await exportPdf({
        filename: "expenses",
        title: "Expense Report",
        business,
        kpis: [
          ["Records", String(expenses.length)],
          ["Total expenses", `$${total.toFixed(2)}`],
        ],
        columns: [
          { header: "Expense", key: "Title" },
          { header: "Category", key: "Category" },
          { header: "Date", key: "Date" },
          { header: "Amount", key: "AmountFmt", align: "right" },
        ],
        rows: exportRows().map((r) => ({
          ...r,
          AmountFmt: `$${Number(r.Amount).toFixed(2)}`,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} expense${selected.size === 1 ? "" : "s"}?`)) return;
    setBulkDeleting(true);
    setError(null);
    try {
      for (const id of selected) {
        const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      }
      clear();
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
      setLoading(true);
      await load();
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Accounting
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Expenses</h1>
          <p className="mt-1 text-sm text-muted">
            {expenses.length} record{expenses.length === 1 ? "" : "s"} · total $
            {total.toFixed(2)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons onExcel={handleExportExcel} onPdf={handleExportPdf} />
          <button
            type="button"
            onClick={openNew}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
          >
            <PlusIcon className="h-4 w-4" /> New Expense
          </button>
        </div>
      </div>

      <BulkBar
        count={selected.size}
        onDelete={handleBulkDelete}
        onClear={clear}
        deleting={bulkDeleting}
      />

      {error && !editing && (
        <p role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-8 grid gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className={checkboxClass}
                    checked={expenses.length > 0 && expenses.every((x) => selected.has(x._id))}
                    onChange={() => toggleAll(expenses.map((x) => x._id))}
                  />
                </th>
                <th className="w-10 px-2 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Expense</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, rowIndex) => (
                <tr
                  key={expense._id}
                  className={`border-b border-line last:border-0 ${
                    selected.has(expense._id) ? "bg-gold/5" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${expense.title}`}
                      className={checkboxClass}
                      checked={selected.has(expense._id)}
                      onChange={() => toggle(expense._id)}
                    />
                  </td>
                  <td className="px-2 py-3 text-xs text-muted">{rowIndex + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{expense.title}</p>
                    {expense.notes && <p className="text-xs text-muted">{expense.notes}</p>}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted">{expense.category}</td>
                  <td className="px-4 py-3 text-muted">{expense.date}</td>
                  <td className="px-4 py-3 font-bold text-red-400">
                    −${expense.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(expense)}
                        aria-label={`Edit ${expense.title}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-gold"
                      >
                        <PencilIcon className="h-4.5 w-4.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(expense)}
                        aria-label={`Delete ${expense.title}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
                      >
                        <TrashIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    No expenses recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={editing === "" ? "New expense" : "Edit expense"}
        >
          <form
            onSubmit={handleSave}
            className="animate-fade-up my-8 w-full max-w-lg rounded-3xl border border-line bg-background p-6 sm:p-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                {editing === "" ? "New Expense" : "Edit Expense"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="e-title" className="text-sm font-semibold">Title</label>
                <input
                  id="e-title"
                  required
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="e-category" className="text-sm font-semibold">Category</label>
                <select
                  id="e-category"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className={inputClass}
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="capitalize">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="e-amount" className="text-sm font-semibold">Amount ($)</label>
                <input
                  id="e-amount"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="e-date" className="text-sm font-semibold">Date</label>
                <input
                  id="e-date"
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="e-notes" className="text-sm font-semibold">Notes</label>
                <input
                  id="e-notes"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="cursor-pointer rounded-full border border-line px-6 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="cursor-pointer rounded-full bg-gold-bright px-7 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : editing === "" ? "Add Expense" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
