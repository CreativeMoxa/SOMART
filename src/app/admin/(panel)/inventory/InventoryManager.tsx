"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { computeProfit } from "@/lib/profit";
import { MOVEMENT_LABELS, type MovementType } from "@/lib/inventoryMovement";
import { ExportButtons } from "@/components/admin/TableTools";
import { XIcon } from "@/components/icons";

type Product = {
  _id: string;
  name: string;
  slug: string;
  category: string;
  imageUrl?: string;
  price: number;
  costPrice?: number;
  stockQty?: number;
  minStock?: number;
  soldCount?: number;
  lastRestockedAt?: string | null;
  lastSoldAt?: string | null;
  createdAt?: string;
};

type Movement = {
  _id: string;
  productName: string;
  type: MovementType;
  qtyBefore: number;
  qtyChange: number;
  qtyAfter: number;
  reference: string;
  note: string;
  user: string;
  createdAt: string;
};

type StockStatus = "in-stock" | "low-stock" | "out-of-stock";
const STATUS_META: Record<StockStatus, { label: string; cls: string }> = {
  "in-stock": { label: "In Stock", cls: "bg-emerald-500/15 text-emerald-500" },
  "low-stock": { label: "Low Stock", cls: "bg-amber-500/15 text-amber-500" },
  "out-of-stock": { label: "Out of Stock", cls: "bg-red-500/15 text-red-500" },
};

const ACTIONS = [
  { key: "receive", label: "Receive Stock" },
  { key: "adjust", label: "Adjust Stock" },
  { key: "count", label: "Stock Count" },
  { key: "write-off", label: "Write Off" },
] as const;
type ActionKey = (typeof ACTIONS)[number]["key"];

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

function money(n: number) {
  return `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function statusOf(p: Product): StockStatus {
  const stock = p.stockQty ?? 0;
  if (stock === 0) return "out-of-stock";
  if (stock <= (p.minStock ?? 5)) return "low-stock";
  return "in-stock";
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DashCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`mt-1.5 text-xl font-bold ${accent ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

export default function InventoryManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "">("");

  // action modal
  const [action, setAction] = useState<{ key: ActionKey; product: Product } | null>(null);
  const [actQty, setActQty] = useState("");
  const [actCount, setActCount] = useState("");
  const [actMinStock, setActMinStock] = useState("");
  const [actNote, setActNote] = useState("");
  const [actSaving, setActSaving] = useState(false);

  // history modal
  const [historyOf, setHistoryOf] = useState<Product | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/inventory/movements?limit=2000"),
      ]);
      if (!pRes.ok) throw new Error("Failed to load inventory");
      setProducts(await pRes.json());
      if (mRes.ok) setMovements(await mRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Dashboard ────────────────────────────────────────────────────────────
  const now = new Date();
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(startDay.getTime() - 7 * 86400000);

  const totalStock = products.reduce((s, p) => s + (p.stockQty ?? 0), 0);
  const inventoryValue = products.reduce((s, p) => s + (p.costPrice || p.price) * (p.stockQty ?? 0), 0);
  const expectedSales = products.reduce((s, p) => s + p.price * (p.stockQty ?? 0), 0);
  const expectedProfit = products.reduce(
    (s, p) => s + (p.price - (p.costPrice ?? 0)) * (p.stockQty ?? 0),
    0
  );
  const lowStock = products.filter((p) => statusOf(p) === "low-stock").length;
  const outOfStock = products.filter((p) => statusOf(p) === "out-of-stock").length;
  const recentlyAdded = products.filter((p) => p.createdAt && new Date(p.createdAt) >= weekAgo).length;
  const soldToday = movements
    .filter((m) => m.type === "invoice-sale" && new Date(m.createdAt) >= startDay)
    .reduce((s, m) => s + Math.abs(m.qtyChange), 0);
  const soldMonth = movements
    .filter((m) => m.type === "invoice-sale" && new Date(m.createdAt) >= startMonth)
    .reduce((s, m) => s + Math.abs(m.qtyChange), 0);

  const visible = products.filter((p) => {
    if (statusFilter && statusOf(p) !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!`${p.name} ${p.category}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Actions ──────────────────────────────────────────────────────────────
  function openAction(key: ActionKey, product: Product) {
    setAction({ key, product });
    setActQty("");
    setActCount(String(product.stockQty ?? 0));
    setActMinStock(String(product.minStock ?? 5));
    setActNote("");
    setError(null);
  }

  async function submitAction(e: FormEvent) {
    e.preventDefault();
    if (!action) return;
    setActSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        productId: action.product._id,
        action: action.key,
        note: actNote,
      };
      if (action.key === "count") payload.count = Number(actCount) || 0;
      else payload.qty = Number(actQty) || 0;
      if (action.key === "receive") payload.minStock = Number(actMinStock) || 0;

      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Action failed");
      setAction(null);
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActSaving(false);
    }
  }

  async function openHistory(product: Product) {
    setHistoryOf(product);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/inventory/movements?productId=${product._id}`);
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────
  function exportRows() {
    return visible.map((p) => {
      const { profitAmount, markupPercent, marginPercent } = computeProfit(p.price, p.costPrice ?? 0);
      const stock = p.stockQty ?? 0;
      return {
        Product: p.name,
        Category: p.category,
        Stock: stock,
        "Min Stock": p.minStock ?? 5,
        Status: STATUS_META[statusOf(p)].label,
        "Cost Price": p.costPrice ?? 0,
        "Selling Price": p.price,
        "Profit/Unit": profitAmount,
        "Markup %": markupPercent,
        "Margin %": marginPercent,
        "Inventory Value": (p.costPrice || p.price) * stock,
        "Expected Sales": p.price * stock,
        "Expected Profit": profitAmount * stock,
      };
    });
  }
  async function handleExcel() {
    const { exportExcel } = await import("@/lib/export");
    exportExcel("store-inventory", exportRows());
  }
  async function handlePdf() {
    try {
      const res = await fetch("/api/settings");
      const business = res.ok ? await res.json() : { companyName: "SOMART" };
      const { exportPdf } = await import("@/lib/export");
      await exportPdf({
        filename: "store-inventory",
        title: "Store Inventory Report",
        business,
        landscape: true,
        kpis: [
          ["Products", String(products.length)],
          ["Total Stock", String(totalStock)],
          ["Inventory Value", money(inventoryValue)],
          ["Expected Profit", money(expectedProfit)],
        ],
        columns: [
          { header: "Product", key: "Product" },
          { header: "Category", key: "Category" },
          { header: "Stock", key: "Stock", align: "right" },
          { header: "Status", key: "Status" },
          { header: "Cost", key: "CostFmt", align: "right" },
          { header: "Sell", key: "SellFmt", align: "right" },
          { header: "Inv. Value", key: "InvFmt", align: "right" },
          { header: "Exp. Profit", key: "ProfitFmt", align: "right" },
        ],
        rows: exportRows().map((r) => ({
          ...r,
          CostFmt: money(Number(r["Cost Price"])),
          SellFmt: money(Number(r["Selling Price"])),
          InvFmt: money(Number(r["Inventory Value"])),
          ProfitFmt: money(Number(r["Expected Profit"])),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Store Inventory
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Inventory</h1>
          <p className="mt-1 text-sm text-muted">{products.length} products in the shop</p>
        </div>
        <ExportButtons onExcel={handleExcel} onPdf={handlePdf} busy={loading} />
      </div>

      {/* Dashboard */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DashCard label="Total Products" value={String(products.length)} accent />
        <DashCard label="Total Stock" value={String(totalStock)} />
        <DashCard label="Inventory Value" value={money(inventoryValue)} />
        <DashCard label="Expected Sales Value" value={money(expectedSales)} />
        <DashCard label="Expected Gross Profit" value={money(expectedProfit)} accent />
        <DashCard label="Low Stock" value={String(lowStock)} />
        <DashCard label="Out of Stock" value={String(outOfStock)} />
        <DashCard label="Recently Added" value={String(recentlyAdded)} />
        <DashCard label="Sold Today" value={String(soldToday)} />
        <DashCard label="Sold This Month" value={String(soldMonth)} />
      </div>

      {/* Search + status filter */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full max-w-xs rounded-xl border border-line bg-surface px-4 py-2.5 text-sm focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40"
        />
        <button
          type="button"
          onClick={() => setStatusFilter("")}
          className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
            statusFilter === "" ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"
          }`}
        >
          All
        </button>
        {(Object.keys(STATUS_META) as StockStatus[]).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
              statusFilter === st ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"
            }`}
          >
            {STATUS_META[st].label}
          </button>
        ))}
      </div>

      {error && !action && (
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
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Cost</th>
                <th className="px-4 py-3 font-semibold">Sell</th>
                <th className="px-4 py-3 font-semibold">Profit · Margin</th>
                <th className="px-4 py-3 font-semibold">Inv. Value</th>
                <th className="px-4 py-3 font-semibold">Last Restock</th>
                <th className="px-4 py-3 font-semibold">Last Sold</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const stock = p.stockQty ?? 0;
                const st = statusOf(p);
                const { profitAmount, marginPercent } = computeProfit(p.price, p.costPrice ?? 0);
                return (
                  <tr key={p._id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-surface" />
                        )}
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-xs capitalize text-muted">{p.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{stock}</span>
                      <span className="block text-xs text-muted">min {p.minStock ?? 5}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_META[st].cls}`}>
                        {STATUS_META[st].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{money(p.costPrice ?? 0)}</td>
                    <td className="px-4 py-3 font-semibold text-gold">{money(p.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${profitAmount < 0 ? "text-red-500" : "text-emerald-500"}`}>
                        {money(profitAmount)}
                      </span>
                      <span className="text-xs text-muted"> · {marginPercent}%</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{money((p.costPrice || p.price) * stock)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtDate(p.lastRestockedAt)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtDate(p.lastSoldAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {ACTIONS.map((a) => (
                          <button
                            key={a.key}
                            type="button"
                            onClick={() => openAction(a.key, p)}
                            className="cursor-pointer rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
                          >
                            {a.label.split(" ")[0]}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => openHistory(p)}
                          className="cursor-pointer rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted">
                    {products.length === 0 ? "No products in inventory yet." : "No products match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Action modal */}
      {action && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Inventory action">
          <form onSubmit={submitAction} className="animate-fade-up my-8 w-full max-w-md rounded-3xl border border-line bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {ACTIONS.find((a) => a.key === action.key)?.label}
              </h2>
              <button type="button" onClick={() => setAction(null)} aria-label="Close" className="cursor-pointer rounded-lg p-2 text-muted hover:bg-surface">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              {action.product.name} · current stock <span className="font-semibold text-foreground">{action.product.stockQty ?? 0}</span>
            </p>

            <div className="mt-5 space-y-4">
              {action.key === "count" ? (
                <div>
                  <label htmlFor="act-count" className="text-sm font-semibold">Counted quantity</label>
                  <input id="act-count" type="number" min="0" value={actCount} onChange={(e) => setActCount(e.target.value)} className={inputClass} required />
                </div>
              ) : (
                <div>
                  <label htmlFor="act-qty" className="text-sm font-semibold">
                    {action.key === "adjust" ? "Adjustment (+/−)" : "Quantity"}
                  </label>
                  <input id="act-qty" type="number" value={actQty} onChange={(e) => setActQty(e.target.value)} className={inputClass} required />
                  {action.key === "adjust" && (
                    <p className="mt-1 text-xs text-muted">Use a negative number to reduce stock.</p>
                  )}
                </div>
              )}
              {action.key === "receive" && (
                <div>
                  <label htmlFor="act-min" className="text-sm font-semibold">Minimum stock (low-stock alert level)</label>
                  <input id="act-min" type="number" min="0" value={actMinStock} onChange={(e) => setActMinStock(e.target.value)} className={inputClass} />
                </div>
              )}
              <div>
                <label htmlFor="act-note" className="text-sm font-semibold">Note <span className="font-normal text-muted">(optional)</span></label>
                <input id="act-note" value={actNote} onChange={(e) => setActNote(e.target.value)} className={inputClass} />
              </div>
            </div>

            {error && action && (
              <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setAction(null)} className="cursor-pointer rounded-full border border-line px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold">
                Cancel
              </button>
              <button type="submit" disabled={actSaving} className="cursor-pointer rounded-full bg-gold-bright px-6 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:opacity-60">
                {actSaving ? "Saving…" : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History modal */}
      {historyOf && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Stock history">
          <div className="animate-fade-up my-8 w-full max-w-3xl rounded-3xl border border-line bg-background p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Stock History</h2>
                <p className="text-sm text-muted">{historyOf.name}</p>
              </div>
              <button type="button" onClick={() => setHistoryOf(null)} aria-label="Close" className="cursor-pointer rounded-lg p-2 text-muted hover:bg-surface">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Movement</th>
                    <th className="px-3 py-2.5 font-semibold">Before</th>
                    <th className="px-3 py-2.5 font-semibold">Change</th>
                    <th className="px-3 py-2.5 font-semibold">After</th>
                    <th className="px-3 py-2.5 font-semibold">Ref</th>
                    <th className="px-3 py-2.5 font-semibold">User</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">Loading…</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">No stock movements yet.</td></tr>
                  ) : (
                    history.map((m) => (
                      <tr key={m._id} className="border-b border-line last:border-0">
                        <td className="px-3 py-2.5 text-xs text-muted">
                          {new Date(m.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td className="px-3 py-2.5">{MOVEMENT_LABELS[m.type] ?? m.type}</td>
                        <td className="px-3 py-2.5 text-muted">{m.qtyBefore}</td>
                        <td className={`px-3 py-2.5 font-semibold ${m.qtyChange < 0 ? "text-red-500" : "text-emerald-500"}`}>
                          {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange}
                        </td>
                        <td className="px-3 py-2.5 font-semibold">{m.qtyAfter}</td>
                        <td className="px-3 py-2.5 text-xs text-muted">{m.reference || "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted">{m.user}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
