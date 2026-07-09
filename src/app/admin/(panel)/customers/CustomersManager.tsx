"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/icons";

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
        <button
          type="button"
          onClick={openNew}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
        >
          <PlusIcon className="h-4 w-4" /> New Customer
        </button>
      </div>

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
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Added</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer._id} className="border-b border-line last:border-0">
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
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
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
