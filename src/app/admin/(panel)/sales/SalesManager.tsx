"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PlusIcon, TrashIcon, XIcon } from "@/components/icons";
import { MARKETING_SOURCES, SOURCE_LABELS, type MarketingSource } from "@/lib/marketing";
import {
  DATE_RANGES,
  RANGE_LABELS,
  inRange,
  normalizeRange,
  type DateRange,
} from "@/lib/dateRange";
import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  DEFAULT_CUSTOMER_TYPE,
  type CustomerType,
} from "@/lib/customerType";
import { useSelection, BulkBar, ExportButtons, checkboxClass } from "@/components/admin/TableTools";

type SaleItem = { name: string; price: number; qty: number };
type Sale = {
  _id: string;
  number: string;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  profit: number;
  paymentMethod: string;
  status?: string;
  source?: string;
  customerType?: string;
  totalCost?: number;
  invoiceId?: string | null;
  createdAt: string;
};
type ProductOption = {
  _id: string;
  name: string;
  price: number;
  discountPercent?: number;
  stockQty?: number;
};
type CustomerOption = { _id: string; name: string; phone: string };

type CartRow = { productId: string; qty: number };

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function unitPrice(p: ProductOption) {
  const pct = p.discountPercent ?? 0;
  return pct > 0 ? Math.round(p.price * (100 - pct)) / 100 : p.price;
}

export default function SalesManager({ initialRange = "" }: { initialRange?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [range, setRange] = useState<DateRange>(normalizeRange(initialRange));
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep the active filter in the URL so it survives refresh and is shareable.
  function applyRange(next: DateRange) {
    setRange(next);
    clear();
    router.replace(next ? `${pathname}?range=${next}` : pathname, { scroll: false });
  }

  const visible = sales.filter((s) => inRange(s.createdAt, range));

  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<CartRow[]>([{ productId: "", qty: 1 }]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [source, setSource] = useState<MarketingSource>("walk-in");
  const [customerType, setCustomerType] = useState<CustomerType>(DEFAULT_CUSTOMER_TYPE);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { selected, toggle, toggleAll, clear } = useSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [salesRes, productsRes, customersRes] = await Promise.all([
        fetch("/api/sales"),
        fetch("/api/products?slim=1"),
        fetch("/api/customers"),
      ]);
      if (!salesRes.ok) throw new Error("Failed to load sales");
      setSales(await salesRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      if (customersRes.ok) setCustomers(await customersRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setCart([{ productId: "", qty: 1 }]);
    setCustomerId("");
    setDiscount("");
    setPaymentMethod("cash");
    setSource("walk-in");
    setCustomerType(DEFAULT_CUSTOMER_TYPE);
    setNote("");
    setError(null);
    setOpen(true);
  }

  function setRow(index: number, row: Partial<CartRow>) {
    setCart((rows) => rows.map((r, i) => (i === index ? { ...r, ...row } : r)));
  }

  const validRows = cart.filter((r) => r.productId);
  const subtotal = validRows.reduce((sum, r) => {
    const product = products.find((p) => p._id === r.productId);
    return product ? sum + unitPrice(product) * r.qty : sum;
  }, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (validRows.length === 0) {
      setError("Add at least one product");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validRows,
          customerId: customerId || null,
          discount: Number(discount) || 0,
          paymentMethod,
          source,
          customerType,
          note,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to record sale");
      setOpen(false);
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record sale");
    } finally {
      setSaving(false);
    }
  }

  function exportRows() {
    return visible.map((s) => ({
      Number: s.number,
      Date: new Date(s.createdAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      Customer: s.customerName,
      "Marketing Source": SOURCE_LABELS[s.source as MarketingSource] ?? "Walk-in",
      "Customer Type": CUSTOMER_TYPE_LABELS[s.customerType as CustomerType] ?? "Retail",
      Status: s.status ?? "completed",
      Items: s.items.map((i) => `${i.name} ×${i.qty}`).join(", "),
      Payment: s.paymentMethod,
      Subtotal: s.subtotal,
      Discount: s.discount,
      Cost: s.totalCost ?? 0,
      Total: s.total,
      Profit: s.profit,
    }));
  }

  async function handleExportExcel() {
    const { exportExcel } = await import("@/lib/export");
    exportExcel("sales", exportRows());
  }

  async function handleExportPdf() {
    setError(null);
    try {
      const res = await fetch("/api/settings");
      const business = res.ok ? await res.json() : { companyName: "SOMART" };
      const completed = visible.filter((s) => s.status !== "pending");
      const { exportPdf } = await import("@/lib/export");
      await exportPdf({
        filename: "sales",
        title: "Sales Report",
        business,
        landscape: true,
        kpis: [
          ["Sales", String(completed.length)],
          ["Revenue", money(completed.reduce((sum, s) => sum + s.total, 0))],
          ["Profit", money(completed.reduce((sum, s) => sum + s.profit, 0))],
        ],
        columns: [
          { header: "Number", key: "Number" },
          { header: "Date", key: "Date" },
          { header: "Customer", key: "Customer" },
          { header: "Source", key: "Marketing Source" },
          { header: "Type", key: "Customer Type" },
          { header: "Status", key: "Status" },
          { header: "Payment", key: "Payment" },
          { header: "Total", key: "TotalFmt", align: "right" },
          { header: "Profit", key: "ProfitFmt", align: "right" },
        ],
        rows: exportRows().map((r) => ({
          ...r,
          TotalFmt: money(Number(r.Total)),
          ProfitFmt: money(Number(r.Profit)),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function handleBulkDelete() {
    if (
      !confirm(
        `Delete ${selected.size} sale${selected.size === 1 ? "" : "s"}? Stock of completed sales will be restored.`
      )
    )
      return;
    setBulkDeleting(true);
    setError(null);
    try {
      for (const id of selected) {
        const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
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

  async function handleDelete(sale: Sale) {
    if (!confirm(`Delete sale ${sale.number}? Stock will be restored (acts as a return).`))
      return;
    try {
      const res = await fetch(`/api/sales/${sale._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      setSales((list) => list.filter((s) => s._id !== sale._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Sales
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Sales History</h1>
          <p className="mt-1 text-sm text-muted">
            {visible.length} sale{visible.length === 1 ? "" : "s"}
            {range ? ` · ${RANGE_LABELS[range]}` : " recorded"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons onExcel={handleExportExcel} onPdf={handleExportPdf} />
          <button
            type="button"
            onClick={openNew}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
          >
            <PlusIcon className="h-4 w-4" /> New Sale
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyRange("")}
          className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
            range === ""
              ? "bg-foreground text-background"
              : "border border-line text-muted hover:border-gold hover:text-gold"
          }`}
        >
          All
        </button>
        {DATE_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => applyRange(r)}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
              range === r
                ? "bg-foreground text-background"
                : "border border-line text-muted hover:border-gold hover:text-gold"
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      <BulkBar
        count={selected.size}
        onDelete={handleBulkDelete}
        onClear={clear}
        deleting={bulkDeleting}
      />

      {error && !open && (
        <p role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-8 grid gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className={checkboxClass}
                    checked={visible.length > 0 && visible.every((s) => selected.has(s._id))}
                    onChange={() => toggleAll(visible.map((s) => s._id))}
                  />
                </th>
                <th className="w-10 px-2 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Sale</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Profit</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((sale, rowIndex) => (
                <tr
                  key={sale._id}
                  className={`border-b border-line last:border-0 ${
                    selected.has(sale._id) ? "bg-gold/5" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${sale.number}`}
                      className={checkboxClass}
                      checked={selected.has(sale._id)}
                      onChange={() => toggle(sale._id)}
                    />
                  </td>
                  <td className="px-2 py-3 text-xs text-muted">{rowIndex + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{sale.number}</p>
                    <p className="text-xs text-muted">
                      {new Date(sale.createdAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {sale.customerName}
                    {sale.invoiceId && (
                      <p className="text-xs text-gold">via invoice</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                      {SOURCE_LABELS[sale.source as MarketingSource] ?? "Walk-in"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                        (sale.status ?? "completed") === "completed"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {sale.status ?? "completed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {sale.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted">
                    {sale.paymentMethod.replace("-", " ")}
                  </td>
                  <td className="px-4 py-3 font-bold text-gold">{money(sale.total)}</td>
                  <td className="px-4 py-3 text-emerald-500">{money(sale.profit)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDelete(sale)}
                        aria-label={`Delete ${sale.number}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
                      >
                        <TrashIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-muted">
                    {sales.length === 0
                      ? "No sales yet — record your first sale."
                      : `No sales in ${range ? RANGE_LABELS[range] : "this view"}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="New sale"
        >
          <form
            onSubmit={handleSave}
            className="animate-fade-up my-8 w-full max-w-2xl rounded-3xl border border-line bg-background p-6 sm:p-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">New Sale</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <span className="text-sm font-semibold">Items</span>
              {cart.map((row, i) => {
                const product = products.find((p) => p._id === row.productId);
                return (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      <select
                        aria-label={`Product ${i + 1}`}
                        value={row.productId}
                        onChange={(e) => setRow(i, { productId: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Select a product…</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id} disabled={(p.stockQty ?? 0) === 0}>
                            {p.name} — {money(unitPrice(p))}
                            {(p.stockQty ?? 0) === 0 ? " (out of stock)" : ` (${p.stockQty} in stock)`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-20">
                      <input
                        aria-label={`Quantity ${i + 1}`}
                        type="number"
                        min="1"
                        max={product?.stockQty ?? 999}
                        value={row.qty}
                        onChange={(e) => setRow(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCart((rows) => rows.filter((_, j) => j !== i))}
                      disabled={cart.length === 1}
                      aria-label="Remove row"
                      className="cursor-pointer rounded-lg p-2.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <TrashIcon className="h-4.5 w-4.5" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setCart((rows) => [...rows, { productId: "", qty: 1 }])}
                className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-gold hover:underline"
              >
                + Add another item
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="s-customer" className="text-sm font-semibold">Customer</label>
                <select
                  id="s-customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Walk-in</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="s-discount" className="text-sm font-semibold">Discount ($)</label>
                <input
                  id="s-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="s-payment" className="text-sm font-semibold">Payment</label>
                <select
                  id="s-payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={inputClass}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="mobile-money">Mobile Money</option>
                  <option value="bank-transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="s-source" className="text-sm font-semibold">
                  Marketing Source
                </label>
                <select
                  id="s-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as MarketingSource)}
                  className={inputClass}
                >
                  {MARKETING_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="s-ctype" className="text-sm font-semibold">
                  Customer Type
                </label>
                <select
                  id="s-ctype"
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                  className={inputClass}
                >
                  {CUSTOMER_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {CUSTOMER_TYPE_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="s-note" className="text-sm font-semibold">
                Note <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="s-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="mt-6 rounded-2xl bg-surface p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold">{money(subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted">Discount</span>
                <span className="font-semibold">−{money(Number(discount) || 0)}</span>
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
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full border border-line px-6 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="cursor-pointer rounded-full bg-gold-bright px-7 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Recording…" : "Complete Sale"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
