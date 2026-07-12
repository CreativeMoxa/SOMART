"use client";

import { useState, type FormEvent } from "react";
import { XIcon } from "@/components/icons";

export type PickerCustomer = {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

export default function QuickAddCustomer({
  initialName = "",
  onClose,
  onCreated,
}: {
  initialName?: string;
  onClose: () => void;
  onCreated: (customer: PickerCustomer) => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, address }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      onCreated(body as PickerCustomer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="New Customer"
    >
      <form
        onSubmit={handleSave}
        className="animate-fade-up my-8 w-full max-w-md rounded-3xl border border-line bg-background p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">New Customer</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="qc-name" className="text-sm font-semibold">Name</label>
            <input
              id="qc-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="qc-phone" className="text-sm font-semibold">Phone</label>
            <input
              id="qc-phone"
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="qc-email" className="text-sm font-semibold">
              Email <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="qc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="qc-address" className="text-sm font-semibold">
              Address <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="qc-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
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
            onClick={onClose}
            className="cursor-pointer rounded-full border border-line px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-full bg-gold-bright px-6 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}
