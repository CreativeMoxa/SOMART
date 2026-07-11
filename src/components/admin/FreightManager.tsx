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
  qty: number;
  costPrice: number;
  sellingPrice: number;
  category: string;
  note: string;
};

type Shipment = {
  _id: string;
  number: string;
  freightType: FreightType;
  name: string;
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

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

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
    qty: 1,
    costPrice: 0,
    sellingPrice: 0,
    category: "",
    note: "",
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");

  // editor: null = closed, "" = new, id = editing
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tracking, setTracking] = useState("");
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
      const [sRes, pRes] = await Promise.all([
        fetch(`/api/shipments?type=${freightType}`),
        fetch("/api/products?slim=1"),
      ]);
      if (!sRes.ok) throw new Error("Failed to load shipments");
      setShipments(await sRes.json());
      if (pRes.ok) setProducts(await pRes.json());
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
  const recentlyReceived = shipments.filter((s) => s.status === "received");
  const productsInTransit = inTransit.reduce((sum, s) => sum + (s.items?.length ?? 0), 0);
  const totalQtyOrdered = inTransit.reduce((sum, s) => sum + (s.totalQty ?? 0), 0);
  const totalShipmentCost = inTransit.reduce((sum, s) => sum + (s.totalCost ?? 0), 0);

  const visible = shipments.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${s.number} ${s.name} ${s.trackingNumber} ${s.items.map((i) => i.name).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // ── Editor ─────────────────────────────────────────────────────────────────
  function openNew() {
    setName("");
    setTracking("");
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
    setTracking(s.trackingNumber);
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

  const editItems = items;
  const editTotalQty = editItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const editTotalCost = editItems.reduce((s, i) => s + (Number(i.costPrice) || 0) * (Number(i.qty) || 0), 0);
  const editExpectedSales = editItems.reduce(
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
        trackingNumber: tracking,
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

  async function updateStatus(s: Shipment, next: string) {
    try {
      const res = await fetch(`/api/shipments/${s._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
      setShipments((list) => list.map((x) => (x._id === s._id ? { ...x, status: next as ShipmentStatus } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function receive(s: Shipment) {
    if (
      !confirm(
        `Receive ${s.number}? All ${s.totalQty} items will be added to Store Inventory. This cannot be undone.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/shipments/${s._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "receive" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Receive failed");
      setLoading(true);
      await load();
      alert(`${s.number} received — stock added to inventory.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receive failed");
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
        <DashCard label="Total Qty Ordered" value={String(totalQtyOrdered)} />
        <DashCard label="Total Shipment Cost" value={money(totalShipmentCost)} />
        <DashCard label="Arriving Soon" value={String(arrivingSoon.length)} />
        <DashCard label="Delayed" value={String(delayed.length)} />
        <DashCard label="Received" value={String(recentlyReceived.length)} />
        <DashCard label="In Transit" value={String(inTransit.length)} />
      </div>

      {/* Search + filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search number, tracking, product…"
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
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Shipment</th>
                <th className="px-4 py-3 font-semibold">Tracking</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Expected</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 font-semibold">Cost</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s._id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{s.number}</p>
                    <p className="text-xs text-muted">{s.name || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{s.trackingNumber || "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Status of ${s.number}`}
                      value={s.status}
                      disabled={s.status === "received"}
                      onChange={(e) => updateStatus(s, e.target.value)}
                      className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-bold ${SHIPMENT_STATUS_COLORS[s.status]} disabled:cursor-not-allowed`}
                    >
                      {SHIPMENT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {SHIPMENT_STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted">{s.expectedArrival || "—"}</td>
                  <td className="px-4 py-3">{s.totalQty}</td>
                  <td className="px-4 py-3 font-semibold text-gold">{money(s.totalCost)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {s.status !== "received" && (
                        <button
                          type="button"
                          onClick={() => receive(s)}
                          className="cursor-pointer rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-500 transition-colors duration-200 hover:bg-emerald-500/25"
                        >
                          Receive
                        </button>
                      )}
                      <a
                        href={`/admin/${meta.path}/${s._id}/print?auto=1`}
                        target="_blank"
                        className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
                      >
                        Print
                      </a>
                      {s.status !== "received" && (
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          aria-label={`Edit ${s.number}`}
                          className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-gold"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {s.status !== "received" && (
                        <button
                          type="button"
                          onClick={() => remove(s)}
                          aria-label={`Delete ${s.number}`}
                          className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
                <label htmlFor="sh-track" className="text-sm font-semibold">Tracking number</label>
                <input id="sh-track" value={tracking} onChange={(e) => setTracking(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="sh-status" className="text-sm font-semibold">Status</label>
                <select id="sh-status" value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)} className={`${inputClass} cursor-pointer`}>
                  {SHIPMENT_STATUSES.filter((st) => st !== "received").map((st) => (
                    <option key={st} value={st}>{SHIPMENT_STATUS_LABELS[st]}</option>
                  ))}
                </select>
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
              <div className="mt-2 space-y-3">
                {items.map((item, i) => {
                  const matches = productMatches(item.name);
                  return (
                    <div key={i} className="rounded-2xl border border-line p-3">
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-line text-muted">
                              <UploadIcon className="h-5 w-5" />
                            </div>
                          )}
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
                        </div>

                        <div className="grid flex-1 gap-2 sm:grid-cols-2">
                          <div className="relative sm:col-span-2">
                            <input
                              aria-label={`Product ${i + 1} name`}
                              placeholder="Product name (or pick an existing product)"
                              autoComplete="off"
                              value={item.name}
                              onChange={(e) => {
                                setItem(i, { name: e.target.value, productId: null });
                                setPickerOpenAt(i);
                              }}
                              onFocus={() => setPickerOpenAt(i)}
                              onBlur={() => setTimeout(() => setPickerOpenAt((v) => (v === i ? null : v)), 150)}
                              className={inputClass}
                            />
                            {pickerOpenAt === i && matches.length > 0 && (
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
                            {item.productId && (
                              <p className="mt-1 text-xs text-emerald-500">✓ Links to existing product — stock will be added on receive</p>
                            )}
                          </div>
                          <input
                            aria-label={`Product ${i + 1} 1688 link`}
                            placeholder="1688 product link"
                            value={item.link1688}
                            onChange={(e) => setItem(i, { link1688: e.target.value })}
                            className={inputClass}
                          />
                          <input
                            aria-label={`Product ${i + 1} category`}
                            placeholder="Category (optional)"
                            value={item.category}
                            onChange={(e) => setItem(i, { category: e.target.value })}
                            className={inputClass}
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input aria-label={`Product ${i + 1} qty`} type="number" min="1" placeholder="Qty" value={item.qty || ""} onChange={(e) => setItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })} className={inputClass} />
                            <input aria-label={`Product ${i + 1} cost`} type="number" min="0" step="0.01" placeholder="Cost" value={item.costPrice || ""} onChange={(e) => setItem(i, { costPrice: Number(e.target.value) || 0 })} className={inputClass} />
                            <input aria-label={`Product ${i + 1} selling`} type="number" min="0" step="0.01" placeholder="Sell" value={item.sellingPrice || ""} onChange={(e) => setItem(i, { sellingPrice: Number(e.target.value) || 0 })} className={inputClass} />
                          </div>
                          <input
                            aria-label={`Product ${i + 1} note`}
                            placeholder="Note (optional)"
                            value={item.note}
                            onChange={(e) => setItem(i, { note: e.target.value })}
                            className={inputClass}
                          />
                          <div className="flex items-center justify-between text-sm sm:col-span-2">
                            <span className="text-muted">
                              Line total: <span className="font-semibold text-foreground">{money((Number(item.costPrice) || 0) * (Number(item.qty) || 0))}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setItems((rows) => (rows.length === 1 ? rows : rows.filter((_, j) => j !== i)))}
                              disabled={items.length === 1}
                              className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500 disabled:opacity-40"
                              aria-label="Remove product"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
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
