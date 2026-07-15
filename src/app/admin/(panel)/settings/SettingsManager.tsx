"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DEFAULT_TEMPLATES, TEMPLATE_PLACEHOLDERS } from "@/lib/templates";
import { UploadIcon } from "@/components/icons";

type Settings = {
  companyName: string;
  tagline: string;
  whatsappNumber: string;
  phone: string;
  salesPhone?: string;
  operationsPhone?: string;
  email: string;
  website?: string;
  address: string;
  businessHours?: string;
  heroImageUrl?: string;
  weeklyOfferProductIds?: string[];
  currency: string;
  currencySymbol: string;
  taxPercent: number;
  bankAccount: string;
  invoiceFooter: string;
  templateWhatsappProduct?: string;
  templateWhatsappDocument?: string;
};

type PickerProduct = {
  _id: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

export default function SettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then(setSettings)
      .catch(() => setError("Failed to load settings"));
    fetch("/api/products?slim=1")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setProducts(data))
      .catch(() => {});
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setSaved(false);
  }

  function toggleOffer(id: string) {
    setSettings((s) => {
      if (!s) return s;
      const current = s.weeklyOfferProductIds ?? [];
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { ...s, weeklyOfferProductIds: next };
    });
    setSaved(false);
  }

  async function handleHeroUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      set("heroImageUrl", body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (heroFileRef.current) heroFileRef.current.value = "";
    }
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
        <h1 className="text-3xl font-bold">Settings</h1>
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  const offerIds = settings.weeklyOfferProductIds ?? [];

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
        Configuration
      </p>
      <h1 className="mt-1 text-3xl font-bold">Business Settings</h1>

      <form onSubmit={handleSave} className="mt-8 max-w-2xl space-y-6">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Company</h2>
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
            <div className="sm:col-span-2">
              <label htmlFor="st-hours" className="text-sm font-semibold">
                Business hours{" "}
                <span className="font-normal text-muted">(shown in the website footer)</span>
              </label>
              <input
                id="st-hours"
                value={settings.businessHours ?? ""}
                onChange={(e) => set("businessHours", e.target.value)}
                placeholder="Mon–Sat: 9am – 7pm"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Contact & WhatsApp</h2>
          <p className="mt-1 text-sm text-muted">
            These power the contact details in the website footer and pages.
          </p>
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
              <label htmlFor="st-sales" className="text-sm font-semibold">Sales phone</label>
              <input
                id="st-sales"
                value={settings.salesPhone ?? ""}
                onChange={(e) => set("salesPhone", e.target.value)}
                placeholder="+252 63 888 4837"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="st-ops" className="text-sm font-semibold">Operations phone</label>
              <input
                id="st-ops"
                value={settings.operationsPhone ?? ""}
                onChange={(e) => set("operationsPhone", e.target.value)}
                placeholder="+252 63 888 4835"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="st-phone" className="text-sm font-semibold">
                General phone{" "}
                <span className="font-normal text-muted">(fallback)</span>
              </label>
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
                placeholder="somartt.co@gmail.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="st-website" className="text-sm font-semibold">Website</label>
              <input
                id="st-website"
                value={settings.website ?? ""}
                onChange={(e) => set("website", e.target.value)}
                placeholder="somart.vercel.app"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ---------------- Public website ---------------- */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Public Website</h2>
          <p className="mt-1 text-sm text-muted">
            Control what shows on the homepage.
          </p>

          <div className="mt-5">
            <span className="text-sm font-semibold">Homepage feature photo</span>
            <p className="text-xs text-muted">
              Shown as the highlighted piece in the hero. Leave empty to use a featured product automatically.
            </p>
            <div className="mt-2 flex items-center gap-3">
              {settings.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.heroImageUrl}
                  alt=""
                  className="h-16 w-24 rounded-xl border border-line object-cover"
                />
              ) : (
                <div className="flex h-16 w-24 items-center justify-center rounded-xl border border-dashed border-line text-muted">
                  <UploadIcon className="h-5 w-5" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold">
                  {uploading ? "Uploading…" : settings.heroImageUrl ? "Replace photo" : "Upload photo"}
                  <input
                    ref={heroFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handleHeroUpload(e.target.files)}
                  />
                </label>
                {settings.heroImageUrl && (
                  <button
                    type="button"
                    onClick={() => set("heroImageUrl", "")}
                    className="cursor-pointer text-left text-xs font-semibold text-red-400 hover:underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <span className="text-sm font-semibold">
              Weekly offer products{" "}
              <span className="font-normal text-muted">
                ({offerIds.length} selected)
              </span>
            </span>
            <p className="text-xs text-muted">
              Tick the products to feature in the homepage &quot;This Week&apos;s Offers&quot; row.
            </p>
            {products.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No products to choose from yet.</p>
            ) : (
              <div className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line bg-background p-2">
                {products.map((p) => {
                  const checked = offerIds.includes(p._id);
                  return (
                    <label
                      key={p._id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
                        checked ? "bg-brand/12" : "hover:bg-surface"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOffer(p._id)}
                        className="h-4 w-4 accent-brand"
                      />
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                      ) : (
                        <span className="h-8 w-8 rounded-md bg-line" />
                      )}
                      <span className="flex-1">
                        <span className="font-medium">{p.name}</span>
                        {p.brand && <span className="text-muted"> · {p.brand}</span>}
                      </span>
                      {checked && (
                        <span className="text-xs font-semibold text-gold">Featured</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Invoicing</h2>
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
          <h2 className="text-lg font-bold">Message Templates</h2>
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
          className="cursor-pointer rounded-full bg-gold-bright px-8 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
