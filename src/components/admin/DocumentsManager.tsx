"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/icons";
import { confirmDialog } from "@/components/admin/ConfirmDialog";
import QuickAddProduct, { type PickerProduct } from "@/components/admin/QuickAddProduct";
import QuickAddCustomer, { type PickerCustomer } from "@/components/admin/QuickAddCustomer";
import { MARKETING_SOURCES, SOURCE_LABELS, type MarketingSource } from "@/lib/marketing";
import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  DEFAULT_CUSTOMER_TYPE,
  type CustomerType,
} from "@/lib/customerType";
import { DEFAULT_TEMPLATES, renderTemplate } from "@/lib/templates";
import { useSelection, BulkBar, ExportButtons, checkboxClass } from "@/components/admin/TableTools";
import type { PdfBusiness } from "@/lib/pdf";

type BusinessSettings = PdfBusiness & { templateWhatsappDocument?: string };

export type DocKind = "invoice" | "quotation";

type LineItem = { productId: string | null; name: string; price: number; qty: number };
type Doc = {
  _id: string;
  number: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: LineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  source?: string;
  customerType?: string;
  paymentMethod?: string;
  saleId?: string | null;
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

// Payment options for invoices — the chosen method carries through to the Sale.
const INVOICE_PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "mobile-money", label: "Mobile Money" },
  { value: "bank-transfer", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function productPrice(p: PickerProduct) {
  const pct = p.discountPercent ?? 0;
  return pct > 0 ? Math.round(p.price * (100 - pct)) / 100 : p.price;
}

function whatsappLink(doc: Doc, kind: DocKind, business: BusinessSettings | null) {
  const template =
    business?.templateWhatsappDocument || DEFAULT_TEMPLATES.whatsappDocument;
  const text = renderTemplate(template, {
    business_name: business?.companyName || "SOMART",
    doc_type: kind === "invoice" ? "Invoice" : "Quotation",
    doc_number: doc.number,
    customer_name: doc.customerName,
    items: doc.items
      .map((i) => `• ${i.name} ×${i.qty} — ${money(i.price * i.qty)}`)
      .join("\n"),
    subtotal: money(doc.subtotal),
    discount: doc.discount > 0 ? `−${money(doc.discount)}` : money(0),
    tax: money(doc.tax),
    total: money(doc.total),
  });
  const phone = doc.customerPhone.replace(/[^0-9]/g, "");
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export default function DocumentsManager({
  kind,
  initialStatus = "",
}: {
  kind: DocKind;
  initialStatus?: string;
}) {
  const cfg = config[kind];
  const router = useRouter();
  const pathname = usePathname();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [statusFilter, setStatusFilter] = useState(
    cfg.statuses.includes(initialStatus) ? initialStatus : ""
  );
  const [loading, setLoading] = useState(true);

  // Keep the status filter in the URL so it survives refresh and drill-downs.
  function applyStatus(next: string) {
    setStatusFilter(next);
    router.replace(next ? `${pathname}?status=${next}` : pathname, { scroll: false });
  }
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { productId: null, name: "", price: 0, qty: 1 },
  ]);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [docDate, setDocDate] = useState("");
  const [status, setStatus] = useState("draft");
  // Status as last saved — a paid invoice already moved stock, so its out-of-stock
  // guard is relaxed (reprints/edits stay allowed).
  const [savedStatus, setSavedStatus] = useState("");
  const [source, setSource] = useState<MarketingSource>("walk-in");
  const [customerType, setCustomerType] = useState<CustomerType>(DEFAULT_CUSTOMER_TYPE);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const printAfterRef = useRef(false);

  // Picker data, loaded when the editor opens
  const [customers, setCustomers] = useState<PickerCustomer[]>([]);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpenAt, setProductOpenAt] = useState<number | null>(null);
  const [quickAddFor, setQuickAddFor] = useState<number | null>(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const { selected, toggle, toggleAll, clear } = useSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => s && setBusiness(s))
      .catch(() => {});
  }, []);

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

  const pickersLoadedRef = useRef(false);
  const loadPickers = useCallback(async () => {
    // Load once per page visit — quick-added customers/products are appended locally.
    if (pickersLoadedRef.current) return;
    pickersLoadedRef.current = true;
    try {
      const [cRes, pRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/products?slim=1"),
      ]);
      if (cRes.ok) setCustomers(await cRes.json());
      if (pRes.ok) setProducts(await pRes.json());
    } catch {
      pickersLoadedRef.current = false;
      // pickers are a convenience; the form still works with free text
    }
  }, []);

  const visible = statusFilter ? docs.filter((d) => d.status === statusFilter) : docs;

  function openNew() {
    setCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setItems([{ productId: null, name: "", price: 0, qty: 1 }]);
    setDiscount("");
    setTax("");
    setDocDate(today());
    setStatus("draft");
    setSavedStatus("");
    setSource("walk-in");
    setCustomerType(DEFAULT_CUSTOMER_TYPE);
    setPaymentMethod("cash");
    setNotes("");
    setEditing("");
    setError(null);
    loadPickers();
  }

  function openEdit(doc: Doc) {
    setCustomerId(doc.customerId ?? null);
    setCustomerName(doc.customerName);
    setCustomerPhone(doc.customerPhone);
    setCustomerAddress(doc.customerAddress ?? "");
    setItems(
      doc.items.map((i) => ({
        productId: i.productId ?? null,
        name: i.name,
        price: i.price,
        qty: i.qty,
      }))
    );
    setDiscount(doc.discount ? String(doc.discount) : "");
    setTax(doc.tax ? String(doc.tax) : "");
    setDocDate(doc[cfg.dateField] ?? "");
    setStatus(doc.status);
    setSavedStatus(doc.status);
    setSource(
      MARKETING_SOURCES.includes(doc.source as MarketingSource)
        ? (doc.source as MarketingSource)
        : "walk-in"
    );
    setCustomerType(
      CUSTOMER_TYPES.includes(doc.customerType as CustomerType)
        ? (doc.customerType as CustomerType)
        : DEFAULT_CUSTOMER_TYPE
    );
    setPaymentMethod(
      INVOICE_PAYMENT_METHODS.some((m) => m.value === doc.paymentMethod)
        ? (doc.paymentMethod as string)
        : "cash"
    );
    setNotes(doc.notes);
    setEditing(doc._id);
    setError(null);
    loadPickers();
  }

  function setItem(index: number, patch: Partial<LineItem>) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function selectCustomer(c: PickerCustomer) {
    setCustomerId(c._id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerAddress(c.address ?? "");
    setCustomerOpen(false);
  }

  function selectProduct(index: number, p: PickerProduct) {
    setItem(index, { productId: p._id, name: p.name, price: productPrice(p) });
    setProductOpenAt(null);
  }

  const customerQuery = customerName.trim().toLowerCase();
  const customerMatches = customerQuery
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(customerQuery) ||
          c.phone.toLowerCase().includes(customerQuery)
      )
    : customers;

  function productMatches(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
    );
  }

  const productById = new Map(products.map((p) => [p._id, p]));

  // Invoice lines whose linked product is out of stock. Printing or paying such
  // an invoice would sell stock that doesn't exist and corrupt sales + money.
  const outOfStockItems =
    kind === "invoice"
      ? items.filter((i) => {
          const p = i.productId ? productById.get(i.productId) : undefined;
          return p !== undefined && (p.stockQty ?? 0) <= 0;
        })
      : [];
  // A paid invoice already deducted stock, so don't block reprinting/editing it.
  const stockBlocks = outOfStockItems.length > 0 && savedStatus !== "paid";
  const outOfStockNames = outOfStockItems.map((i) => i.name).join(", ");

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));

  async function getBusiness(): Promise<PdfBusiness> {
    if (business) return business;
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("Failed to load business settings");
    const s = (await res.json()) as BusinessSettings;
    setBusiness(s);
    return s;
  }

  async function downloadPdf(doc: Doc) {
    setError(null);
    try {
      const biz = await getBusiness();
      const { downloadDocumentPdf } = await import("@/lib/pdf");
      await downloadDocumentPdf(doc, biz, kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF download failed");
    }
  }

  function exportRows() {
    return visible.map((d) => ({
      Number: d.number,
      Date: new Date(d.createdAt).toLocaleDateString("en-US"),
      Customer: d.customerName,
      Phone: d.customerPhone,
      "Marketing Source": SOURCE_LABELS[d.source as MarketingSource] ?? "Walk-in",
      "Customer Type": CUSTOMER_TYPE_LABELS[d.customerType as CustomerType] ?? "Retail",
      Status: d.status,
      [cfg.dateLabel]: d[cfg.dateField] || "",
      Items: d.items.map((i) => `${i.name} ×${i.qty}`).join(", "),
      Subtotal: d.subtotal,
      Discount: d.discount,
      Tax: d.tax,
      Total: d.total,
    }));
  }

  async function handleExportExcel() {
    const { exportExcel } = await import("@/lib/export");
    exportExcel(cfg.title.toLowerCase(), exportRows());
  }

  async function handleExportPdf() {
    setError(null);
    try {
      const biz = await getBusiness();
      const { exportPdf } = await import("@/lib/export");
      await exportPdf({
        filename: cfg.title.toLowerCase(),
        title: `${cfg.title} Report`,
        subtitle: statusFilter ? `Status: ${statusFilter}` : "All statuses",
        business: biz,
        landscape: true,
        kpis: [
          ["Documents", String(visible.length)],
          ["Total value", money(visible.reduce((s, d) => s + d.total, 0))],
        ],
        columns: [
          { header: "Number", key: "Number" },
          { header: "Date", key: "Date" },
          { header: "Customer", key: "Customer" },
          { header: "Type", key: "Customer Type" },
          { header: "Status", key: "Status" },
          { header: cfg.dateLabel, key: cfg.dateLabel },
          { header: "Total", key: "TotalFmt", align: "right" },
        ],
        rows: exportRows().map((r) => ({ ...r, TotalFmt: money(Number(r.Total)) })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function handleBulkDelete() {
    if (!(await confirmDialog(`Delete ${selected.size} ${cfg.title.toLowerCase()}? This cannot be undone.`)))
      return;
    setBulkDeleting(true);
    setError(null);
    try {
      for (const id of selected) {
        const res = await fetch(`${cfg.api}/${id}`, { method: "DELETE" });
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

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const printAfter = printAfterRef.current;
    printAfterRef.current = false;

    // Block the stock-consuming paths (print, or saving straight to paid) when a
    // line's product is out of stock — this is what corrupts sales + money.
    if (kind === "invoice" && stockBlocks && (printAfter || status === "paid")) {
      setError(
        `${outOfStockNames} ${outOfStockItems.length === 1 ? "is" : "are"} out of stock — ` +
          `restock before ${printAfter ? "printing" : "marking this invoice paid"}.`
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Link the document to a customer record: reuse a selected/matching one,
      // otherwise save the newly typed customer so they can be reused next time.
      let cid = customerId;
      if (!cid && customerName.trim() && customerPhone.trim()) {
        const existing = customers.find(
          (c) => c.phone.trim() === customerPhone.trim()
        );
        if (existing) {
          cid = existing._id;
        } else {
          try {
            const res = await fetch("/api/customers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: customerName.trim(), phone: customerPhone.trim() }),
            });
            if (res.ok) cid = ((await res.json()) as PickerCustomer)._id;
          } catch {
            // the document still saves without a linked customer record
          }
        }
      }

      const isNew = editing === "";
      const payload = {
        customerId: cid,
        customerName,
        customerPhone,
        customerAddress,
        items: items.filter((i) => i.name.trim()),
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        [cfg.dateField]: docDate,
        status,
        source,
        customerType,
        paymentMethod,
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
      if (printAfter) {
        const id = isNew ? body._id : editing;
        const url = `/admin/${kind}s/${id}/print?auto=1`;
        const win = window.open(url, "_blank");
        if (!win) window.location.href = url;
      }
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
      // Paid/unpaid moves inventory + sales, so refresh from the server.
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(doc: Doc) {
    if (!(await confirmDialog(`Delete ${cfg.singular.toLowerCase()} ${doc.number}?`))) return;
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
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons onExcel={handleExportExcel} onPdf={handleExportPdf} />
          <button
            type="button"
            onClick={openNew}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
          >
            <PlusIcon className="h-4 w-4" /> New {cfg.singular}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyStatus("")}
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
            onClick={() => applyStatus(s)}
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

      <BulkBar
        count={selected.size}
        onDelete={handleBulkDelete}
        onClear={clear}
        deleting={bulkDeleting}
      />

      {loading ? (
        <div className="mt-6 grid gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className={checkboxClass}
                    checked={visible.length > 0 && visible.every((d) => selected.has(d._id))}
                    onChange={() => toggleAll(visible.map((d) => d._id))}
                  />
                </th>
                <th className="w-10 px-2 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Number</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">{cfg.dateLabel}</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((doc, rowIndex) => (
                <tr
                  key={doc._id}
                  className={`border-b border-line last:border-0 ${
                    selected.has(doc._id) ? "bg-gold/5" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${doc.number}`}
                      className={checkboxClass}
                      checked={selected.has(doc._id)}
                      onChange={() => toggle(doc._id)}
                    />
                  </td>
                  <td className="px-2 py-3 text-xs text-muted">{rowIndex + 1}</td>
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
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                      {SOURCE_LABELS[doc.source as MarketingSource] ?? "Walk-in"}
                    </span>
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
                      <button
                        type="button"
                        onClick={() => downloadPdf(doc)}
                        className="cursor-pointer rounded-full border border-gold/50 px-3 py-1.5 text-xs font-semibold text-gold transition-colors duration-200 hover:border-gold hover:bg-gold/10"
                      >
                        ⬇ PDF
                      </button>
                      <a
                        href={`/admin/${kind}s/${doc._id}/print?auto=1`}
                        target="_blank"
                        className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
                      >
                        Print
                      </a>
                      <a
                        href={whatsappLink(doc, kind, business)}
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
                  <td colSpan={9} className="px-4 py-12 text-center text-muted">
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
              <div className="relative">
                <label htmlFor="d-customer" className="text-sm font-semibold">Customer name</label>
                <input
                  id="d-customer"
                  required
                  autoComplete="off"
                  placeholder="Search customers or type a new name"
                  value={customerName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomerName(value);
                    setCustomerId(null);
                    // Clearing the name drops the linked customer's number/details
                    // so a stale phone/address doesn't stick to the next customer.
                    if (!value.trim()) {
                      setCustomerPhone("");
                      setCustomerAddress("");
                    }
                    setCustomerOpen(true);
                  }}
                  onFocus={() => setCustomerOpen(true)}
                  onBlur={() => setTimeout(() => setCustomerOpen(false), 150)}
                  className={inputClass}
                />
                {customerOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-background shadow-xl">
                    {customerMatches.map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectCustomer(c);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-surface ${
                          customerId === c._id ? "text-gold" : ""
                        }`}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted">{c.phone}</span>
                      </button>
                    ))}
                    {customerMatches.length === 0 && (
                      <p className="px-3.5 py-2.5 text-sm text-muted">No matching customer.</p>
                    )}
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setAddingCustomer(true);
                        setCustomerOpen(false);
                      }}
                      className="sticky bottom-0 flex w-full cursor-pointer items-center gap-2 border-t border-line bg-background px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-gold transition-colors duration-150 hover:bg-surface"
                    >
                      <PlusIcon className="h-3.5 w-3.5" /> Add new customer
                    </button>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted">
                  {customerId
                    ? "✓ Existing customer selected"
                    : customerName.trim()
                      ? customerPhone.trim()
                        ? "New customer — will be added to Customers on save"
                        : "Add a phone number to save this customer for reuse"
                      : "Pick an existing customer or type a new one"}
                </p>
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
              <div className="sm:col-span-2">
                <label htmlFor="d-address" className="text-sm font-semibold">
                  Customer address <span className="font-normal text-muted">(shown on the PDF)</span>
                </label>
                <input
                  id="d-address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <span className="text-sm font-semibold">Line items</span>
              {items.map((item, i) => {
                const matched = item.productId ? productById.get(item.productId) : undefined;
                const matches = productMatches(item.name);
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-end sm:gap-2 sm:rounded-none sm:border-0 sm:p-0"
                  >
                    <div className="flex min-w-0 flex-1 items-end gap-2">
                    {matched?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={matched.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-lg border border-dashed border-line" />
                    )}
                    <div className="relative min-w-0 flex-1">
                      <label className="mb-1 block text-xs font-semibold text-muted sm:hidden">
                        Product
                      </label>
                      <input
                        aria-label={`Item ${i + 1} description`}
                        placeholder="Search products or type a description"
                        autoComplete="off"
                        value={item.name}
                        onChange={(e) => {
                          setItem(i, { name: e.target.value, productId: null });
                          setProductOpenAt(i);
                        }}
                        onFocus={() => setProductOpenAt(i)}
                        onBlur={() => setTimeout(() => setProductOpenAt((v) => (v === i ? null : v)), 150)}
                        className={inputClass}
                      />
                      {productOpenAt === i && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-background shadow-xl">
                          {matches.map((p) => (
                            <button
                              key={p._id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectProduct(i, p);
                              }}
                              className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface"
                            >
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.imageUrl}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-[10px] uppercase text-muted">
                                  {p.name.slice(0, 2)}
                                </div>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{p.name}</span>
                                <span className="block text-xs text-muted">
                                  {p.brand} · {(p.stockQty ?? 0) > 0 ? `${p.stockQty} in stock` : "out of stock"}
                                </span>
                              </span>
                              <span className="shrink-0 font-semibold text-gold">
                                {money(productPrice(p))}
                              </span>
                            </button>
                          ))}
                          {matches.length === 0 && (
                            <p className="px-3.5 py-2.5 text-sm text-muted">
                              No matching product — text will be used as a custom item.
                            </p>
                          )}
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setQuickAddFor(i);
                              setProductOpenAt(null);
                            }}
                            className="sticky bottom-0 flex w-full cursor-pointer items-center gap-2 border-t border-line bg-background px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-gold transition-colors duration-150 hover:bg-surface"
                          >
                            <PlusIcon className="h-3.5 w-3.5" /> Add new product
                          </button>
                        </div>
                      )}
                    </div>
                    </div>
                    <div className="flex items-end gap-2 sm:contents">
                    <div className="min-w-0 flex-1 sm:w-28 sm:flex-none">
                      <label className="mb-1 block text-xs font-semibold text-muted sm:hidden">
                        Price
                      </label>
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
                    <div className="w-20 shrink-0">
                      <label className="mb-1 block text-xs font-semibold text-muted sm:hidden">
                        Qty
                      </label>
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
                      className="shrink-0 cursor-pointer rounded-lg p-2.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <TrashIcon className="h-4.5 w-4.5" />
                    </button>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  setItems((rows) => [...rows, { productId: null, name: "", price: 0, qty: 1 }])
                }
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

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="d-status" className="text-sm font-semibold">Status</label>
                <select
                  id="d-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`${inputClass} cursor-pointer capitalize`}
                >
                  {cfg.statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {kind === "invoice" && status === "paid" && (
                  <p className="mt-1 text-xs text-emerald-500">
                    Paid invoices record a sale and deduct stock automatically.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="d-source" className="text-sm font-semibold">
                  Marketing Source <span className="font-normal text-muted">(not printed)</span>
                </label>
                <select
                  id="d-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as MarketingSource)}
                  className={`${inputClass} cursor-pointer`}
                >
                  {MARKETING_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="d-ctype" className="text-sm font-semibold">
                  Customer Type <span className="font-normal text-muted">(not printed)</span>
                </label>
                <select
                  id="d-ctype"
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                  className={`${inputClass} cursor-pointer`}
                >
                  {CUSTOMER_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {CUSTOMER_TYPE_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {kind === "invoice" && (
              <div className="mt-4">
                <label htmlFor="d-payment" className="text-sm font-semibold">
                  Payment method{" "}
                  <span className="font-normal text-muted">(used by Sales)</span>
                </label>
                <select
                  id="d-payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  {INVOICE_PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {kind === "invoice" && stockBlocks && (
              <p className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-500">
                {outOfStockNames} {outOfStockItems.length === 1 ? "is" : "are"} out of
                stock. Restock before printing or marking this invoice paid — selling
                unavailable stock corrupts your sales and money records.
              </p>
            )}

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

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="cursor-pointer rounded-full border border-line px-6 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (kind === "invoice" && stockBlocks)}
                title={
                  kind === "invoice" && stockBlocks
                    ? `${outOfStockNames} out of stock — restock before printing`
                    : undefined
                }
                onClick={() => {
                  printAfterRef.current = true;
                }}
                className="cursor-pointer rounded-full border border-gold px-6 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-gold transition-colors duration-200 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save & Print"}
              </button>
              <button
                type="submit"
                disabled={saving}
                onClick={() => {
                  printAfterRef.current = false;
                }}
                className="cursor-pointer rounded-full bg-gold-bright px-7 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : editing === "" ? `Create ${cfg.singular}` : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {quickAddFor !== null && (
        <QuickAddProduct
          onClose={() => setQuickAddFor(null)}
          onCreated={(p) => {
            setProducts((list) => [p, ...list]);
            selectProduct(quickAddFor, p);
            setQuickAddFor(null);
          }}
        />
      )}

      {addingCustomer && (
        <QuickAddCustomer
          initialName={customerId ? "" : customerName}
          onClose={() => setAddingCustomer(false)}
          onCreated={(c) => {
            setCustomers((list) => [c, ...list]);
            selectCustomer(c);
            setAddingCustomer(false);
          }}
        />
      )}
    </div>
  );
}
