"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/icons";

export type DocKind = "invoice" | "quotation";

type LineItem = { name: string; price: number; qty: number };
type Doc = {
  _id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  items: LineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  dueDate?: string;
  validUntil?: string;
  notes: string;
  invoiceId?: string | null;
  createdAt: string;
};

const config = {
  invoice: {
    api: "/api/invoices",
    title: "Invoices",
    singular: "Invoice",
    statuses: ["draft", "unpaid", "paid", "overdue"],
    dateField: "dueDate" as const,
    dateLabel: "Due date",
    statusColors: {
      draft: "bg-surface text-muted",
      unpaid: "bg-amber-500/15 text-amber-500",
      paid: "bg-emerald-500/15 text-emerald-500",
      overdue: "bg-red-500/15 text-red-500",
    } as Record<string, string>,
  },
  quotation: {
    api: "/api/quotations",
    title: "Quotations",
    singular: "Quotation",
    statuses: ["draft", "sent", "approved", "rejected"],
    dateField: "validUntil" as const,
    dateLabel: "Valid until",
    statusColors: {
      draft: "bg-surface text-muted",
      sent: "bg-sky-500/15 text-sky-500",
      approved: "bg-emerald-500/15 text-emerald-500",
      rejected: "bg-red-500/15 text-red-500",
    } as Record<string, string>,
  },
};

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function whatsappLink(doc: Doc, kind: DocKind) {
  const lines = [
    `*SOMART — ${kind === "invoice" ? "Invoice" : "Quotation"} ${doc.number}*`,
    "",
    ...doc.items.map((i) => `• ${i.name} ×${i.qty} — ${money(i.price * i.qty)}`),
    "",
    `Subtotal: ${money(doc.subtotal)}`,
    ...(doc.discount > 0 ? [`Discount: −${money(doc.discount)}`] : []),
    ...(doc.tax > 0 ? [`Tax: ${money(doc.tax)}`] : []),
    `*Total: ${money(doc.total)}*`,
  ];
  const phone = doc.customerPhone.replace(/[^0-9]/g, "");
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export default function DocumentsManager({ kind }: { kind: DocKind }) {
  const cfg = config[kind];
  const [docs, setDocs] = useState<Doc[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ name: "", price: 0, qty: 1 }]);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [docDate, setDocDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(cfg.api);
      if (!res.ok) throw new Error(`Failed to load ${cfg.title.toLowerCase()}`);
      setDocs(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [cfg.api, cfg.title]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = statusFilter ? docs.filter((d) => d.status === statusFilter) : docs;

  function openNew() {
    setCustomerName("");
    setCustomerPhone("");
    setItems([{ name: "", price: 0, qty: 1 }]);
    setDiscount("");
    setTax("");
    setDocDate("");
    setNotes("");
    setEditing("");
    setError(null);
  }

  function openEdit(doc: Doc) {
    setCustomerName(doc.customerName);
    setCustomerPhone(doc.customerPhone);
    setItems(doc.items.map((i) => ({ name: i.name, price: i.price, qty: i.qty })));
    setDiscount(doc.discount ? String(doc.discount) : "");
    setTax(doc.tax ? String(doc.tax) : "");
    setDocDate(doc[cfg.dateField] ?? "");
    setNotes(doc.notes);
    setEditing(doc._id);
    setError(null);
  }

  function setItem(index: number, patch: Partial<LineItem>) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isNew = editing === "";
      const payload = {
        customerName,
        customerPhone,
        items: items.filter((i) => i.name.trim()),
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        [cfg.dateField]: docDate,
        notes,
      };
      const res = await fetch(isNew ? cfg.api : `${cfg.api}/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  async function updateStatus(doc: Doc, status: string) {
    try {
      const res = await fetch(`${cfg.api}/${doc._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
      setDocs((list) => list.map((d) => (d._id === doc._id ? { ...d, status } : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`Delete ${cfg.singular.toLowerCase()} ${doc.number}?`)) return;
    try {
      const res = await fetch(`${cfg.api}/${doc._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      setDocs((list) => list.filter((d) => d._id !== doc._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function convertToInvoice(doc: Doc) {
    try {
      const res = await fetch(`${cfg.api}/${doc._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Convert failed");
      setLoading(true);
      await load();
      alert(`Created invoice ${body.invoice.number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Convert failed");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Billing
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{cfg.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {docs.length} {cfg.title.toLowerCase()}
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
        >
          <PlusIcon className="h-4 w-4" /> New {cfg.singular}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("")}
          className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
            statusFilter === ""
              ? "bg-foreground text-background"
              : "border border-line text-muted hover:border-gold hover:text-gold"
          }`}
        >
          All
        </button>
        {cfg.statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
              statusFilter === s
                ? "bg-foreground text-background"
                : "border border-line text-muted hover:border-gold hover:text-gold"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && !editing && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-6 grid gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Number</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">{cfg.dateLabel}</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((doc) => (
                <tr key={doc._id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{doc.number}</p>
                    <p className="text-xs text-muted">
                      {new Date(doc.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{doc.customerName}</p>
                    <p className="text-xs text-muted">{doc.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3 font-bold text-gold">{money(doc.total)}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Status of ${doc.number}`}
                      value={doc.status}
                      onChange={(e) => updateStatus(doc, e.target.value)}
                      className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-bold capitalize ${cfg.statusColors[doc.status] ?? ""}`}
                    >
                      {cfg.statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted">{doc[cfg.dateField] || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <a
                        href={`/admin/${kind}s/${doc._id}/print`}
                        target="_blank"
                        className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
                      >
                        Print / PDF
                      </a>
                      <a
                        href={whatsappLink(doc, kind)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-emerald-500 transition-colors duration-200 hover:border-emerald-500"
                      >
                        WhatsApp
                      </a>
                      {kind === "quotation" && !doc.invoiceId && (
                        <button
                          type="button"
                          onClick={() => convertToInvoice(doc)}
                          className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-gold transition-colors duration-200 hover:border-gold"
                        >
                          → Invoice
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(doc)}
                        aria-label={`Edit ${doc.number}`}
                        className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-gold"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        aria-label={`Delete ${doc.number}`}
                        className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    No {cfg.title.toLowerCase()} yet.
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
          aria-label={editing === "" ? `New ${cfg.singular}` : `Edit ${cfg.singular}`}
        >
          <form
            onSubmit={handleSave}
            className="animate-fade-up my-8 w-full max-w-2xl rounded-3xl border border-line bg-background p-6 sm:p-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                {editing === "" ? `New ${cfg.singular}` : `Edit ${cfg.singular}`}
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
              <div>
                <label htmlFor="d-customer" className="text-sm font-semibold">Customer name</label>
                <input
                  id="d-customer"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="d-phone" className="text-sm font-semibold">
                  Customer phone <span className="font-normal text-muted">(for WhatsApp)</span>
                </label>
                <input
                  id="d-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <span className="text-sm font-semibold">Line items</span>
              {items.map((item, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <input
                      aria-label={`Item ${i + 1} description`}
                      placeholder="Description"
                      value={item.name}
                      onChange={(e) => setItem(i, { name: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="w-28">
                    <input
                      aria-label={`Item ${i + 1} price`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={item.price || ""}
                      onChange={(e) => setItem(i, { price: Number(e.target.value) || 0 })}
                      className={inputClass}
                    />
                  </div>
                  <div className="w-20">
                    <input
                      aria-label={`Item ${i + 1} quantity`}
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => setItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems((rows) => rows.filter((_, j) => j !== i))}
                    disabled={items.length === 1}
                    aria-label="Remove line"
                    className="cursor-pointer rounded-lg p-2.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <TrashIcon className="h-4.5 w-4.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setItems((rows) => [...rows, { name: "", price: 0, qty: 1 }])}
                className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-gold hover:underline"
              >
                + Add line
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="d-discount" className="text-sm font-semibold">Discount ($)</label>
                <input
                  id="d-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="d-tax" className="text-sm font-semibold">Tax ($)</label>
                <input
                  id="d-tax"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="d-date" className="text-sm font-semibold">{cfg.dateLabel}</label>
                <input
                  id="d-date"
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="d-notes" className="text-sm font-semibold">Notes</label>
              <textarea
                id="d-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="mt-6 rounded-2xl bg-surface p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold">{money(subtotal)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-2 text-base">
                <span className="font-bold">Total</span>
                <span className="font-bold text-gold">{money(total)}</span>
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
                {saving ? "Saving…" : editing === "" ? `Create ${cfg.singular}` : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
