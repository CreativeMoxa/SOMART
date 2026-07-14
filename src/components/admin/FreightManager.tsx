"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon, TrashIcon, UploadIcon, XIcon } from "@/components/icons";
import {
  FREIGHT_META,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_COLORS,
  SHIPMENT_STATUS_LABELS,
  type FreightType,
  type ShipmentStatus,
} from "@/lib/freight";

type ShipmentItem = {
  productId: string | null;
  name: string;
  imageUrl: string;
  link1688: string;
  trackingNumber: string;
  qty: number;
  costPrice: number;
  sellingPrice: number;
  brand: string;
  category: string;
  minStock: number;
  description: string;
  note: string;
  received: boolean;
  receivedAt: string | null;
};

type Shipment = {
  _id: string;
  number: string;
  freightType: FreightType;
  name: string;
  cargo: string;
  trackingNumber: string;
  shippingDate: string;
  expectedArrival: string;
  status: ShipmentStatus;
  notes: string;
  items: ShipmentItem[];
  totalQty: number;
  totalCost: number;
  expectedSalesValue: number;
  receivedAt: string | null;
  createdAt: string;
};

type ProductOption = {
  _id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  costPrice?: number;
  imageUrl?: string;
};

const CATEGORIES = ["eyeglasses", "sunglasses", "watches", "accessories"];

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40 disabled:cursor-not-allowed disabled:opacity-50";

function money(n: number) {
  return `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function emptyItem(): ShipmentItem {
  return {
    productId: null,
    name: "",
    imageUrl: "",
    link1688: "",
    trackingNumber: "",
    qty: 1,
    costPrice: 0,
    sellingPrice: 0,
    brand: "",
    category: "accessories",
    minStock: 5,
    description: "",
    note: "",
    received: false,
    receivedAt: null,
  };
}

function DashCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`mt-1.5 text-xl font-bold ${accent ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

export default function FreightManager({ freightType }: { freightType: FreightType }) {
  const meta = FREIGHT_META[freightType];
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemBusy, setItemBusy] = useState<string | null>(null); // `${shipId}:${idx}`

  // editor: null = closed, "" = new, id = editing
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cargo, setCargo] = useState("");
  const [shippingDate, setShippingDate] = useState("");
  const [expectedArrival, setExpectedArrival] = useState("");
  const [status, setStatus] = useState<ShipmentStatus>("preparing");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ShipmentItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [uploadingRow, setUploadingRow] = useState<number | null>(null);
  const [pickerOpenAt, setPickerOpenAt] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const [sRes, pRes, cRes] = await Promise.all([
        fetch(`/api/shipments?type=${freightType}`),
        fetch("/api/products?slim=1"),
        fetch("/api/shipments?distinct=cargo"),
      ]);
      if (!sRes.ok) throw new Error("Failed to load shipments");
      setShipments(await sRes.json());
      if (pRes.ok) setProducts(await pRes.json());
      if (cRes.ok) setCargos(await cRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [freightType]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Dashboard metrics ──────────────────────────────────────────────────────
  const todayKey = today();
  const soonKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const inTransit = shipments.filter((s) => s.status !== "received");
  const arrivingSoon = inTransit.filter(
    (s) => s.expectedArrival && s.expectedArrival >= todayKey && s.expectedArrival <= soonKey
  );
  const delayed = inTransit.filter((s) => s.expectedArrival && s.expectedArrival < todayKey);
  const receivedCount = shipments.filter((s) => s.status === "received").length;
  const productsInTransit = shipments.reduce(
    (sum, s) => sum + s.items.filter((i) => !i.received).length,
    0
  );
  const totalQtyOrdered = shipments.reduce(
    (sum, s) => sum + s.items.filter((i) => !i.received).reduce((q, i) => q + i.qty, 0),
    0
  );
  const totalShipmentCost = inTransit.reduce((sum, s) => sum + (s.totalCost ?? 0), 0);

  const visible = shipments.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${s.number} ${s.name} ${s.cargo} ${s.trackingNumber} ${s.items
        .map((i) => `${i.name} ${i.trackingNumber}`)
        .join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // ── Editor ─────────────────────────────────────────────────────────────────
  function openNew() {
    setName("");
    setCargo("");
    setShippingDate(today());
    setExpectedArrival("");
    setStatus("preparing");
    setNotes("");
    setItems([emptyItem()]);
    setEditing("");
    setError(null);
  }

  function openEdit(s: Shipment) {
    setName(s.name);
    setCargo(s.cargo ?? "");
    setShippingDate(s.shippingDate);
    setExpectedArrival(s.expectedArrival);
    setStatus(s.status);
    setNotes(s.notes);
    setItems(s.items.length ? s.items.map((i) => ({ ...i })) : [emptyItem()]);
    setEditing(s._id);
    setError(null);
  }

  function setItem(i: number, patch: Partial<ShipmentItem>) {
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function linkProduct(i: number, p: ProductOption) {
    setItem(i, {
      productId: p._id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      costPrice: p.costPrice ?? 0,
      sellingPrice: p.price,
      imageUrl: p.imageUrl || "",
    });
    setPickerOpenAt(null);
  }

  async function uploadImage(i: number, file: File) {
    setUploadingRow(i);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      setItem(i, { imageUrl: body.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingRow(null);
      const ref = fileRefs.current[i];
      if (ref) ref.value = "";
    }
  }

  const editTotalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const editTotalCost = items.reduce((s, i) => s + (Number(i.costPrice) || 0) * (Number(i.qty) || 0), 0);
  const editExpectedSales = items.reduce(
    (s, i) => s + (Number(i.sellingPrice) || 0) * (Number(i.qty) || 0),
    0
  );

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isNew = editing === "";
      const payload = {
        freightType,
        name,
        cargo,
        shippingDate,
        expectedArrival,
        status,
        notes,
        items: items.filter((i) => i.name.trim()),
      };
      const res = await fetch(isNew ? "/api/shipments" : `/api/shipments/${editing}`, {
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

  // ── Per-item receive / unreceive ───────────────────────────────────────────
  async function toggleItemReceived(s: Shipment, index: number, receive: boolean) {
    setItemBusy(`${s._id}:${index}`);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${s._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: receive ? "receive-item" : "unreceive-item", index }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Update failed");
      setShipments((list) => list.map((x) => (x._id === s._id ? body : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setItemBusy(null);
    }
  }

  async function remove(s: Shipment) {
    if (!confirm(`Delete ${s.number}?`)) return;
    try {
      const res = await fetch(`/api/shipments/${s._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      setShipments((list) => list.filter((x) => x._id !== s._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // ── PDF download (same layout idea as the printable page) ─────────────────
  async function downloadPdf(s: Shipment) {
    setError(null);
    try {
      const res = await fetch("/api/settings");
      const business = res.ok ? await res.json() : { companyName: "SOMART" };
      const { exportPdf } = await import("@/lib/export");
      await exportPdf({
        filename: s.number,
        title: meta.label,
        subtitle: [s.name, s.cargo && `Cargo: ${s.cargo}`, s.expectedArrival && `Expected: ${s.expectedArrival}`]
          .filter(Boolean)
          .join(" · "),
        business,
        kpis: [
          ["Shipment", s.number],
          ["Total Quantity", String(s.totalQty)],
          ["Shipment Total", money(s.totalCost)],
          ["Status", SHIPMENT_STATUS_LABELS[s.status]],
        ],
        columns: [
          { header: "Product", key: "Product" },
          { header: "Track", key: "Track" },
          { header: "Qty", key: "Qty", align: "right" },
          { header: "Cost Price", key: "Cost", align: "right" },
          { header: "Total Cost", key: "Total", align: "right" },
        ],
        rows: s.items.map((i) => ({
          Product: i.name,
          Track: i.trackingNumber || "—",
          Qty: i.qty,
          Cost: money(i.costPrice),
          Total: money(i.costPrice * i.qty),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF download failed");
    }
  }

  const productMatches = (q: string) => {
    const s = q.trim().toLowerCase();
    if (!s) return products.slice(0, 8);
    return products
      .filter((p) => p.name.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s))
      .slice(0, 8);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Incoming Inventory
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{meta.label}</h1>
          <p className="mt-1 text-sm text-muted">
            {shipments.length} shipment{shipments.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
        >
          <PlusIcon className="h-4 w-4" /> New {meta.label} Shipment
        </button>
      </div>

      {/* Dashboard */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashCard label="Total Shipments" value={String(shipments.length)} accent />
        <DashCard label="Products In Transit" value={String(productsInTransit)} />
        <DashCard label="Qty Awaiting Arrival" value={String(totalQtyOrdered)} />
        <DashCard label="Cost In Transit" value={money(totalShipmentCost)} />
        <DashCard label="Arriving Soon" value={String(arrivingSoon.length)} />
        <DashCard label="Delayed" value={String(delayed.length)} />
        <DashCard label="Received" value={String(receivedCount)} />
        <DashCard label="In Transit" value={String(inTransit.length)} />
      </div>

      {/* Search + filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search number, cargo, track, product…"
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
        {SHIPMENT_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
              statusFilter === st ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"
            }`}
          >
            {SHIPMENT_STATUS_LABELS[st]}
          </button>
        ))}
      </div>

      {error && editing === null && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-6 grid gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Shipment</th>
                <th className="px-4 py-3 font-semibold">Cargo</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Expected</th>
                <th className="px-4 py-3 font-semibold">Received</th>
                <th className="px-4 py-3 font-semibold">Total Cost</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const receivedItems = s.items.filter((i) => i.received).length;
                const isOpen = expanded === s._id;
                return [
                  <tr
                    key={s._id}
                    onClick={() => setExpanded(isOpen ? null : s._id)}
                    className="cursor-pointer border-b border-line transition-colors duration-150 last:border-0 hover:bg-surface/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">
                        <span className="mr-1.5 inline-block text-xs text-muted">{isOpen ? "▾" : "▸"}</span>
                        {s.number}
                      </p>
                      <p className="pl-5 text-xs text-muted">{s.name || "—"}</p>
                    </td>
                    <td className="px-4 py-3">{s.cargo || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${SHIPMENT_STATUS_COLORS[s.status]}`}>
                        {SHIPMENT_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{s.expectedArrival || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          receivedItems === s.items.length && s.items.length > 0
                            ? "bg-emerald-500/15 text-emerald-500"
                            : receivedItems > 0
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-surface text-muted"
                        }`}
                      >
                        {receivedItems}/{s.items.length} products
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gold">{money(s.totalCost)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => downloadPdf(s)}
                          className="cursor-pointer rounded-full border border-gold/50 px-3 py-1.5 text-xs font-semibold text-gold transition-colors duration-200 hover:border-gold hover:bg-gold/10"
                        >
                          ⬇ PDF
                        </button>
                        <a
                          href={`/admin/${meta.path}/${s._id}/print?auto=1`}
                          target="_blank"
                          className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
                        >
                          Print
                        </a>
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          aria-label={`Edit ${s.number}`}
                          className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-gold"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(s)}
                          aria-label={`Delete ${s.number}`}
                          className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`${s._id}-items`} className="border-b border-line bg-surface/40 last:border-0">
                      <td colSpan={7} className="px-4 py-4">
                        <table className="w-full text-left text-sm">
                          <thead className="text-[11px] uppercase tracking-wider text-muted">
                            <tr>
                              <th className="pb-2 font-semibold">Product</th>
                              <th className="pb-2 font-semibold">Track</th>
                              <th className="pb-2 text-right font-semibold">Qty</th>
                              <th className="pb-2 text-right font-semibold">Cost Price</th>
                              <th className="pb-2 text-right font-semibold">Total Cost</th>
                              <th className="pb-2 text-right font-semibold">Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.items.map((item, idx) => (
                              <tr key={idx} className="border-t border-line/60">
                                <td className="py-2.5">
                                  <div className="flex items-center gap-2.5">
                                    {item.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={item.imageUrl} alt="" className="h-9 w-9 rounded-lg border border-line object-cover" />
                                    ) : (
                                      <div className="h-9 w-9 rounded-lg bg-surface" />
                                    )}
                                    <div>
                                      <p className="font-medium">{item.name}</p>
                                      {item.link1688 && (
                                        <a
                                          href={item.link1688}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-gold hover:underline"
                                        >
                                          1688 ↗
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 font-mono text-xs text-muted">{item.trackingNumber || "—"}</td>
                                <td className="py-2.5 text-right">{item.qty}</td>
                                <td className="py-2.5 text-right text-muted">{money(item.costPrice)}</td>
                                <td className="py-2.5 text-right font-semibold">{money(item.costPrice * item.qty)}</td>
                                <td className="py-2.5 text-right">
                                  {item.received ? (
                                    <span className="inline-flex items-center gap-2">
                                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-500">
                                        ✓ Received
                                      </span>
                                      <button
                                        type="button"
                                        disabled={itemBusy === `${s._id}:${idx}`}
                                        onClick={() => toggleItemReceived(s, idx, false)}
                                        className="cursor-pointer rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted transition-colors duration-200 hover:border-red-500 hover:text-red-500 disabled:opacity-50"
                                      >
                                        Undo
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={itemBusy === `${s._id}:${idx}`}
                                      onClick={() => toggleItemReceived(s, idx, true)}
                                      className="cursor-pointer rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-500 transition-colors duration-200 hover:bg-emerald-500/25 disabled:opacity-50"
                                    >
                                      {itemBusy === `${s._id}:${idx}` ? "…" : "Receive"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t border-line/60 text-sm font-semibold">
                              <td className="py-2.5" colSpan={2}>
                                Totals
                              </td>
                              <td className="py-2.5 text-right">{s.totalQty}</td>
                              <td className="py-2.5" />
                              <td className="py-2.5 text-right text-gold">{money(s.totalCost)}</td>
                              <td className="py-2.5" />
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ),
                ];
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    {shipments.length === 0
                      ? `No ${meta.label.toLowerCase()} shipments yet.`
                      : "No shipments match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor modal */}
      {editing !== null && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={editing === "" ? `New ${meta.singular}` : `Edit ${meta.singular}`}
        >
          <form
            onSubmit={handleSave}
            className="animate-fade-up my-8 w-full max-w-4xl rounded-3xl border border-line bg-background p-6 sm:p-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                {editing === "" ? `New ${meta.singular}` : `Edit ${meta.singular}`}
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

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="sh-name" className="text-sm font-semibold">Shipment name</label>
                <input id="sh-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. February phones batch" />
              </div>
              <div>
                <label htmlFor="sh-cargo" className="text-sm font-semibold">
                  Cargo <span className="font-normal text-muted">(carrier company)</span>
                </label>
                <input
                  id="sh-cargo"
                  list="cargo-suggestions"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Deero Cargo"
                />
                <datalist id="cargo-suggestions">
                  {cargos.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="sh-status" className="text-sm font-semibold">Status</label>
                <select id="sh-status" value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)} className={`${inputClass} cursor-pointer`}>
                  {SHIPMENT_STATUSES.map((st) => (
                    <option key={st} value={st}>{SHIPMENT_STATUS_LABELS[st]}</option>
                  ))}
                </select>
                {status === "received" && (
                  <p className="mt-1 text-xs text-emerald-500">
                    Received adds all products to inventory. Switching back removes them again.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="sh-ship" className="text-sm font-semibold">Shipping date</label>
                <input id="sh-ship" type="date" value={shippingDate} onChange={(e) => setShippingDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="sh-arr" className="text-sm font-semibold">Expected arrival</label>
                <input id="sh-arr" type="date" value={expectedArrival} onChange={(e) => setExpectedArrival(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="mt-6">
              <span className="text-sm font-semibold">Products in this shipment</span>
              <p className="text-xs text-muted">
                Brand, category and min-stock are silent info — used to create the store product on receive, never printed.
              </p>
              <div className="mt-2 space-y-3">
                {items.map((item, i) => {
                  const matches = productMatches(item.name);
                  const locked = item.received;
                  return (
                    <div key={i} className={`rounded-2xl border p-3 ${locked ? "border-emerald-500/40 bg-emerald-500/5" : "border-line"}`}>
                      {locked && (
                        <p className="mb-2 text-xs font-bold text-emerald-500">
                          ✓ Received into inventory — un-receive it from the shipment list to edit.
                        </p>
                      )}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="relative flex shrink-0 items-start gap-2 sm:block">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-line text-muted">
                              <UploadIcon className="h-5 w-5" />
                            </div>
                          )}
                          {!locked && (
                            <label className="mt-1 block cursor-pointer text-center text-[10px] font-semibold uppercase text-gold hover:underline">
                              {uploadingRow === i ? "…" : "Photo"}
                              <input
                                ref={(el) => {
                                  fileRefs.current[i] = el;
                                }}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && uploadImage(i, e.target.files[0])}
                              />
                            </label>
                          )}
                        </div>

                        <div className="grid flex-1 gap-2 sm:grid-cols-2">
                          <div className="relative sm:col-span-2">
                            <input
                              aria-label={`Product ${i + 1} name`}
                              placeholder="Product name (or pick an existing product)"
                              autoComplete="off"
                              disabled={locked}
                              value={item.name}
                              onChange={(e) => {
                                setItem(i, { name: e.target.value, productId: null });
                                setPickerOpenAt(i);
                              }}
                              onFocus={() => setPickerOpenAt(i)}
                              onBlur={() => setTimeout(() => setPickerOpenAt((v) => (v === i ? null : v)), 150)}
                              className={inputClass}
                            />
                            {!locked && pickerOpenAt === i && matches.length > 0 && (
                              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-background shadow-xl">
                                {matches.map((p) => (
                                  <button
                                    key={p._id}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      linkProduct(i, p);
                                    }}
                                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface"
                                  >
                                    <span className="font-medium">{p.name}</span>
                                    <span className="text-xs text-muted">links to stock</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {item.productId && !locked && (
                              <p className="mt-1 text-xs text-emerald-500">✓ Links to existing product — stock is added when you receive it</p>
                            )}
                          </div>
                          <input
                            aria-label={`Product ${i + 1} tracking number`}
                            placeholder="Tracking number (this product)"
                            disabled={locked}
                            value={item.trackingNumber}
                            onChange={(e) => setItem(i, { trackingNumber: e.target.value })}
                            className={inputClass}
                          />
                          <input
                            aria-label={`Product ${i + 1} 1688 link`}
                            placeholder="1688 product link"
                            disabled={locked}
                            value={item.link1688}
                            onChange={(e) => setItem(i, { link1688: e.target.value })}
                            className={inputClass}
                          />
                          <input
                            aria-label={`Product ${i + 1} brand`}
                            placeholder="Brand (for the product page)"
                            disabled={locked}
                            value={item.brand}
                            onChange={(e) => setItem(i, { brand: e.target.value })}
                            className={inputClass}
                          />
                          <select
                            aria-label={`Product ${i + 1} category`}
                            disabled={locked}
                            value={item.category}
                            onChange={(e) => setItem(i, { category: e.target.value })}
                            className={`${inputClass} cursor-pointer capitalize`}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <input aria-label={`Product ${i + 1} qty`} type="number" min="1" placeholder="Qty" disabled={locked} value={item.qty || ""} onChange={(e) => setItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })} className={inputClass} />
                            <input aria-label={`Product ${i + 1} cost`} type="number" min="0" step="0.01" placeholder="Cost" disabled={locked} value={item.costPrice || ""} onChange={(e) => setItem(i, { costPrice: Number(e.target.value) || 0 })} className={inputClass} />
                            <input aria-label={`Product ${i + 1} selling`} type="number" min="0" step="0.01" placeholder="Sell" disabled={locked} value={item.sellingPrice || ""} onChange={(e) => setItem(i, { sellingPrice: Number(e.target.value) || 0 })} className={inputClass} />
                            <input aria-label={`Product ${i + 1} min stock`} type="number" min="0" placeholder="Min" title="Minimum stock (low-stock alert)" disabled={locked} value={item.minStock ?? ""} onChange={(e) => setItem(i, { minStock: Math.max(0, Number(e.target.value) || 0) })} className={inputClass} />
                          </div>
                          <input
                            aria-label={`Product ${i + 1} note`}
                            placeholder="Note (optional)"
                            disabled={locked}
                            value={item.note}
                            onChange={(e) => setItem(i, { note: e.target.value })}
                            className={inputClass}
                          />
                          <div className="flex items-center justify-between text-sm sm:col-span-2">
                            <span className="text-muted">
                              Line total: <span className="font-semibold text-foreground">{money((Number(item.costPrice) || 0) * (Number(item.qty) || 0))}</span>
                            </span>
                            {!locked && (
                              <button
                                type="button"
                                onClick={() => setItems((rows) => (rows.length === 1 ? rows : rows.filter((_, j) => j !== i)))}
                                disabled={items.length === 1}
                                className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500 disabled:opacity-40"
                                aria-label="Remove product"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setItems((rows) => [...rows, emptyItem()])}
                className="mt-3 cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-gold hover:underline"
              >
                + Add product
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-surface p-4 text-sm">
                <p className="text-muted">Total quantity</p>
                <p className="mt-1 text-lg font-bold">{editTotalQty}</p>
              </div>
              <div className="rounded-2xl bg-surface p-4 text-sm">
                <p className="text-muted">Total cost</p>
                <p className="mt-1 text-lg font-bold text-gold">{money(editTotalCost)}</p>
              </div>
              <div className="rounded-2xl bg-surface p-4 text-sm">
                <p className="text-muted">Expected sales value</p>
                <p className="mt-1 text-lg font-bold text-emerald-500">{money(editExpectedSales)}</p>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="sh-notes" className="text-sm font-semibold">Notes</label>
              <textarea id="sh-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </div>

            {error && editing !== null && (
              <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="cursor-pointer rounded-full border border-line px-6 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="cursor-pointer rounded-full bg-gold-bright px-7 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:opacity-60">
                {saving ? "Saving…" : editing === "" ? "Create Shipment" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
