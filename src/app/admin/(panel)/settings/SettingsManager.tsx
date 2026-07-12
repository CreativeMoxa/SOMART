"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_TEMPLATES, TEMPLATE_PLACEHOLDERS } from "@/lib/templates";

type Settings = {
  companyName: string;
  tagline: string;
  whatsappNumber: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  currencySymbol: string;
  taxPercent: number;
  bankAccount: string;
  invoiceFooter: string;
  templateWhatsappProduct?: string;
  templateWhatsappDocument?: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

export default function SettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then(setSettings)
      .catch(() => setError("Failed to load settings"));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setSaved(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
        Configuration
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Business Settings</h1>

      <form onSubmit={handleSave} className="mt-8 max-w-2xl space-y-6">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Company</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="st-name" className="text-sm font-semibold">Company name</label>
              <input
                id="st-name"
                value={settings.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="st-tagline" className="text-sm font-semibold">Tagline</label>
              <input
                id="st-tagline"
                value={settings.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="st-address" className="text-sm font-semibold">Address</label>
              <input
                id="st-address"
                value={settings.address}
                onChange={(e) => set("address", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Contact & WhatsApp</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="st-whatsapp" className="text-sm font-semibold">
                WhatsApp number{" "}
                <span className="font-normal text-muted">(with country code, e.g. 2526…)</span>
              </label>
              <input
                id="st-whatsapp"
                value={settings.whatsappNumber}
                onChange={(e) => set("whatsappNumber", e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">
                Used for the &quot;Order on WhatsApp&quot; buttons on the website.
              </p>
            </div>
            <div>
              <label htmlFor="st-phone" className="text-sm font-semibold">Phone</label>
              <input
                id="st-phone"
                value={settings.phone}
                onChange={(e) => set("phone", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="st-email" className="text-sm font-semibold">Email</label>
              <input
                id="st-email"
                type="email"
                value={settings.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Invoicing</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="st-currency" className="text-sm font-semibold">Currency</label>
              <input
                id="st-currency"
                value={settings.currency}
                onChange={(e) => set("currency", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="st-symbol" className="text-sm font-semibold">Symbol</label>
              <input
                id="st-symbol"
                value={settings.currencySymbol}
                onChange={(e) => set("currencySymbol", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="st-tax" className="text-sm font-semibold">Default tax (%)</label>
              <input
                id="st-tax"
                type="number"
                min="0"
                max="100"
                value={settings.taxPercent}
                onChange={(e) => set("taxPercent", Number(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="st-bank" className="text-sm font-semibold">
                Payment account number{" "}
                <span className="font-normal text-muted">(shown on invoices as &quot;on this account:&quot;)</span>
              </label>
              <input
                id="st-bank"
                value={settings.bankAccount ?? ""}
                onChange={(e) => set("bankAccount", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="st-footer" className="text-sm font-semibold">
                Invoice footer text
              </label>
              <input
                id="st-footer"
                value={settings.invoiceFooter}
                onChange={(e) => set("invoiceFooter", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Message Templates</h2>
          <p className="mt-1 text-sm text-muted">
            Customize the wording of automatic messages. Placeholders in {"{curly}"}{" "}
            braces are replaced with real values automatically.
          </p>
          <div className="mt-4 space-y-5">
            <div>
              <label htmlFor="st-tpl-product" className="text-sm font-semibold">
                WhatsApp — &quot;Order on WhatsApp&quot; product button
              </label>
              <textarea
                id="st-tpl-product"
                rows={4}
                value={settings.templateWhatsappProduct ?? DEFAULT_TEMPLATES.whatsappProduct}
                onChange={(e) => set("templateWhatsappProduct", e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">
                Placeholders: {TEMPLATE_PLACEHOLDERS.whatsappProduct.join(" · ")}
              </p>
            </div>
            <div>
              <label htmlFor="st-tpl-document" className="text-sm font-semibold">
                WhatsApp — invoice / quotation share message
              </label>
              <textarea
                id="st-tpl-document"
                rows={4}
                value={settings.templateWhatsappDocument ?? DEFAULT_TEMPLATES.whatsappDocument}
                onChange={(e) => set("templateWhatsappDocument", e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">
                Placeholders: {TEMPLATE_PLACEHOLDERS.whatsappDocument.join(" · ")}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-500">
            Settings saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="cursor-pointer rounded-full bg-gold-bright px-8 py-3 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
