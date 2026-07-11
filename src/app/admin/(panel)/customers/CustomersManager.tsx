"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon, TrashIcon, UploadIcon, XIcon } from "@/components/icons";
import { useSelection, BulkBar, ExportButtons, checkboxClass } from "@/components/admin/TableTools";

type Customer = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
};

type Purchase = {
  _id: string;
  number: string;
  total: number;
  createdAt: string;
  items: { name: string; qty: number }[];
};

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };
type FormState = typeof emptyForm;

// Header names we recognise in uploaded Excel/CSV files (case-insensitive).
const HEADER_ALIASES: Record<keyof FormState, string[]> = {
  name: ["name", "customer", "customer name", "full name", "fullname"],
  phone: ["phone", "phone number", "mobile", "tel", "telephone", "number", "contact", "whatsapp"],
  email: ["email", "e-mail", "mail"],
  address: ["address", "location", "city"],
  notes: ["notes", "note", "comment", "comments", "remark", "remarks"],
};

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

export default function CustomersManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editing: null = closed, "" = new, id = editing
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const { selected, toggle, toggleAll, clear } = useSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async (q?: string) => {
    try {
      const res = await fetch(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (!res.ok) throw new Error("Failed to load customers");
      setCustomers(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setForm(emptyForm);
    setPurchases([]);
    setEditing("");
    setError(null);
  }

  async function openEdit(customer: Customer) {
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
    });
    setEditing(customer._id);
    setError(null);
    setPurchases([]);
    try {
      const res = await fetch(`/api/customers/${customer._id}`);
      if (res.ok) {
        const body = await res.json();
        setPurchases(body.purchases ?? []);
      }
    } catch {
      // purchase history is non-critical
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isNew = editing === "";
      const res = await fetch(isNew ? "/api/customers" : `/api/customers/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setEditing(null);
      setLoading(true);
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResult(null);
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("The file has no sheets");

      // Try header-based mapping first (first row contains column names).
      const objects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      const firstRow = objects[0] ?? {};
      const keyFor = (field: keyof FormState) => {
        const aliases = HEADER_ALIASES[field];
        return Object.keys(firstRow).find((k) =>
          aliases.includes(k.trim().toLowerCase())
        );
      };
      const nameKey = keyFor("name");
      const phoneKey = keyFor("phone");

      let rows: Record<string, unknown>[];
      if (nameKey && phoneKey) {
        const emailKey = keyFor("email");
        const addressKey = keyFor("address");
        const notesKey = keyFor("notes");
        rows = objects.map((r) => ({
          name: r[nameKey],
          phone: r[phoneKey],
          email: emailKey ? r[emailKey] : "",
          address: addressKey ? r[addressKey] : "",
          notes: notesKey ? r[notesKey] : "",
        }));
      } else {
        // No recognisable headers: assume columns are name, phone, email, address, notes.
        const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
        const looksLikeHeader = (cell: unknown) =>
          [...HEADER_ALIASES.name, ...HEADER_ALIASES.phone].includes(
            String(cell ?? "").trim().toLowerCase()
          );
        const dataRows =
          grid.length > 0 && (looksLikeHeader(grid[0][0]) || looksLikeHeader(grid[0][1]))
            ? grid.slice(1)
            : grid;
        rows = dataRows.map((r) => ({
          name: r[0],
          phone: r[1],
          email: r[2] ?? "",
          address: r[3] ?? "",
          notes: r[4] ?? "",
        }));
      }

      if (rows.length === 0) throw new Error("No rows found in the file");

      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: rows }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed");
      setImportResult(
        `Imported ${body.imported} customer${body.imported === 1 ? "" : "s"}` +
          (body.duplicates ? `, ${body.duplicates} duplicate${body.duplicates === 1 ? "" : "s"} skipped` : "") +
          (body.invalid ? `, ${body.invalid} row${body.invalid === 1 ? "" : "s"} missing name/phone` : "") +
          "."
      );
      setLoading(true);
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  function exportRows() {
    return customers.map((c) => ({
      Name: c.name,
      Phone: c.phone,
      Email: c.email ?? "",
      Address: c.address ?? "",
      Notes: c.notes ?? "",
      Added: new Date(c.createdAt).toLocaleDateString("en-US"),
    }));
  }

  async function handleExportExcel() {
    const { exportExcel } = await import("@/lib/export");
    exportExcel("customers", exportRows());
  }

  async function handleExportPdf() {
    setError(null);
    try {
      const res = await fetch("/api/settings");
      const business = res.ok ? await res.json() : { companyName: "SOMART" };
      const { exportPdf } = await import("@/lib/export");
      await exportPdf({
        filename: "customers",
        title: "Customer Report",
        subtitle: query ? `Search: ${query}` : "All customers",
        business,
        kpis: [["Customers", String(customers.length)]],
        columns: [
          { header: "Name", key: "Name" },
          { header: "Phone", key: "Phone" },
          { header: "Email", key: "Email" },
          { header: "Address", key: "Address" },
          { header: "Added", key: "Added" },
        ],
        rows: exportRows(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} customer${selected.size === 1 ? "" : "s"}?`)) return;
    setBulkDeleting(true);
    setError(null);
    try {
      for (const id of selected) {
        const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      }
      clear();
      setLoading(true);
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
      setLoading(true);
      await load(query);
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`Delete customer "${customer.name}"?`)) return;
    try {
      const res = await fetch(`/api/customers/${customer._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      setCustomers((list) => list.filter((c) => c._id !== customer._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Customers
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Customer Directory</h1>
          <p className="mt-1 text-sm text-muted">
            {customers.length} customer{customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons onExcel={handleExportExcel} onPdf={handleExportPdf} />
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-full border border-gold px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-gold transition-colors duration-200 hover:bg-gold/10 ${
              importing ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <UploadIcon className="h-4 w-4" />
            {importing ? "Importing…" : "Import Excel"}
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
            />
          </label>
          <button
            type="button"
            onClick={openNew}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
          >
            <PlusIcon className="h-4 w-4" /> New Customer
          </button>
        </div>
      </div>

      {importResult && (
        <p className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-500">
          {importResult}
        </p>
      )}

      <input
        type="search"
        placeholder="Search by name, phone or email…"
        aria-label="Search customers"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-6 w-full max-w-sm rounded-xl border border-line bg-surface px-4 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40"
      />

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
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className={checkboxClass}
                    checked={customers.length > 0 && customers.every((c) => selected.has(c._id))}
                    onChange={() => toggleAll(customers.map((c) => c._id))}
                  />
                </th>
                <th className="w-10 px-2 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Added</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer, rowIndex) => (
                <tr
                  key={customer._id}
                  className={`border-b border-line last:border-0 ${
                    selected.has(customer._id) ? "bg-gold/5" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${customer.name}`}
                      className={checkboxClass}
                      checked={selected.has(customer._id)}
                      onChange={() => toggle(customer._id)}
                    />
                  </td>
                  <td className="px-2 py-3 text-xs text-muted">{rowIndex + 1}</td>
                  <td className="px-4 py-3 font-semibold">{customer.name}</td>
                  <td className="px-4 py-3 text-muted">{customer.phone}</td>
                  <td className="px-4 py-3 text-muted">{customer.email || "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(customer.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(customer)}
                        aria-label={`Edit ${customer.name}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-gold"
                      >
                        <PencilIcon className="h-4.5 w-4.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(customer)}
                        aria-label={`Delete ${customer.name}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
                      >
                        <TrashIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    No customers found.
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
          aria-label={editing === "" ? "New customer" : "Edit customer"}
        >
          <form
            onSubmit={handleSave}
            className="animate-fade-up my-8 w-full max-w-lg rounded-3xl border border-line bg-background p-6 sm:p-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                {editing === "" ? "New Customer" : "Edit Customer"}
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
                <label htmlFor="c-name" className="text-sm font-semibold">Name</label>
                <input
                  id="c-name"
                  required
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="c-phone" className="text-sm font-semibold">Phone</label>
                <input
                  id="c-phone"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="c-email" className="text-sm font-semibold">Email</label>
                <input
                  id="c-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="c-address" className="text-sm font-semibold">Address</label>
                <input
                  id="c-address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="c-notes" className="text-sm font-semibold">Notes</label>
              <textarea
                id="c-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className={inputClass}
              />
            </div>

            {editing !== "" && (
              <div className="mt-5">
                <p className="text-sm font-semibold">Purchase History</p>
                {purchases.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">No purchases yet.</p>
                ) : (
                  <ul className="mt-2 max-h-40 divide-y divide-line overflow-y-auto rounded-xl border border-line px-3">
                    {purchases.map((purchase) => (
                      <li key={purchase._id} className="flex justify-between py-2 text-sm">
                        <span>
                          <span className="font-semibold">{purchase.number}</span>{" "}
                          <span className="text-muted">
                            · {purchase.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}
                          </span>
                        </span>
                        <span className="font-semibold text-gold">
                          ${purchase.total.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
                {saving ? "Saving…" : editing === "" ? "Add Customer" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
