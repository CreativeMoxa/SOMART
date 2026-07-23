"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_TEMPLATES, TEMPLATE_PLACEHOLDERS } from "@/lib/templates";
import { UploadIcon } from "@/components/icons";

type SaleItem = { imageUrl: string; title: string; subtitle: string };

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
  heroImageTitle?: string;
  heroImageSubtitle?: string;
  saleItems?: SaleItem[];
  currency: string;
  currencySymbol: string;
  taxPercent: number;
  bankAccount: string;
  invoiceFooter: string;
  templateWhatsappProduct?: string;
  templateWhatsappDocument?: string;
};

const EMPTY_SALE: SaleItem = { imageUrl: "", title: "", subtitle: "" };

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

export default function SettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

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

  // Always work with exactly 3 sale slots in the UI.
  function saleSlots(): SaleItem[] {
    const items = settings?.saleItems ?? [];
    return [0, 1, 2].map((i) => items[i] ?? { ...EMPTY_SALE });
  }

  function setSaleItem(index: number, patch: Partial<SaleItem>) {
    setSettings((s) => {
      if (!s) return s;
      const slots = [0, 1, 2].map((i) => (s.saleItems ?? [])[i] ?? { ...EMPTY_SALE });
      slots[index] = { ...slots[index], ...patch };
      return { ...s, saleItems: slots };
    });
    setSaved(false);
  }

  async function uploadImage(file: File): Promise<string> {
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: data });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Upload failed");
    return body.url as string;
  }

  function handleUpload(
    key: string,
    input: HTMLInputElement,
    apply: (url: string) => void
  ) {
    const file = input.files?.[0];
    if (!file) return;
    setUploadingKey(key);
    setError(null);
    uploadImage(file)
      .then(apply)
      .catch((err) => setError(err instanceof Error ? err.message : "Upload failed"))
      .finally(() => {
        setUploadingKey(null);
        input.value = "";
      });
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

  const slots = saleSlots();

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
                placeholder="252 ......"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="st-ops" className="text-sm font-semibold">Operations phone</label>
              <input
                id="st-ops"
                value={settings.operationsPhone ?? ""}
                onChange={(e) => set("operationsPhone", e.target.value)}
                placeholder="252 ......"
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
            Control the homepage feature photo.
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
                  {uploadingKey === "hero"
                    ? "Uploading…"
                    : settings.heroImageUrl
                      ? "Replace photo"
                      : "Upload photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingKey !== null}
                    onChange={(e) =>
                      handleUpload("hero", e.currentTarget, (url) => set("heroImageUrl", url))
                    }
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
            <label htmlFor="st-hero-title" className="text-sm font-semibold">
              Feature photo name
            </label>
            <input
              id="st-hero-title"
              value={settings.heroImageTitle ?? ""}
              onChange={(e) => set("heroImageTitle", e.target.value)}
              placeholder="e.g. Ray-Ban Aviator — Gold"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted">
              The name shown on the homepage hero &quot;featured piece&quot; card.
              Leave empty to show your brand name.
            </p>
          </div>
          <div className="mt-4">
            <label htmlFor="st-hero-sub" className="text-sm font-semibold">
              Feature photo caption{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="st-hero-sub"
              value={settings.heroImageSubtitle ?? ""}
              onChange={(e) => set("heroImageSubtitle", e.target.value)}
              placeholder="e.g. New this week"
              className={inputClass}
            />
          </div>
        </div>

        {/* ---------------- Sale section (3 custom slots) ---------------- */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Sale</h2>
          <p className="mt-1 text-sm text-muted">
            Add up to 3 sale items. These are the only products shown on the
            homepage — each with a photo, a title and a short note. Customers tap
            &quot;Ask price on WhatsApp&quot; to order. Leave a slot empty to hide it.
          </p>
          <div className="mt-5 space-y-4">
            {slots.map((slot, i) => (
              <div key={i} className="rounded-2xl border border-line bg-background p-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-gold">
                  Sale slot {i + 1}
                </p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row">
                  <div className="flex shrink-0 items-start gap-2">
                    {slot.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slot.imageUrl}
                        alt=""
                        className="h-20 w-20 rounded-xl border border-line object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-line text-muted">
                        <UploadIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-sm font-semibold">Title</label>
                      <input
                        value={slot.title}
                        onChange={(e) => setSaleItem(i, { title: e.target.value })}
                        placeholder="e.g. Ray-Ban Aviator — Gold"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">
                        Short note <span className="font-normal text-muted">(optional)</span>
                      </label>
                      <input
                        value={slot.subtitle}
                        onChange={(e) => setSaleItem(i, { subtitle: e.target.value })}
                        placeholder="e.g. Limited stock — polarized lenses"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold">
                        {uploadingKey === `sale-${i}`
                          ? "Uploading…"
                          : slot.imageUrl
                            ? "Replace photo"
                            : "Upload photo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingKey !== null}
                          onChange={(e) =>
                            handleUpload(`sale-${i}`, e.currentTarget, (url) =>
                              setSaleItem(i, { imageUrl: url })
                            )
                          }
                        />
                      </label>
                      {(slot.title || slot.subtitle || slot.imageUrl) && (
                        <button
                          type="button"
                          onClick={() => setSaleItem(i, { ...EMPTY_SALE })}
                          className="cursor-pointer text-xs font-semibold text-red-400 hover:underline"
                        >
                          Clear slot
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
