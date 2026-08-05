"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_TEMPLATES, TEMPLATE_PLACEHOLDERS } from "@/lib/templates";
import { UploadIcon } from "@/components/icons";

type SaleItem = { imageUrl: string; images?: string[]; title: string; subtitle: string };

type Settings = {
  deliveryCities?: string[];
  customerCities?: string[];
  companyName: string;
  tagline: string;
  elementLogoUrl?: string;
  nameLogoUrl?: string;
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

const EMPTY_SALE: SaleItem = { imageUrl: "", images: [], title: "", subtitle: "" };
const imagesOf = (s: SaleItem) => (s.images?.length ? s.images : s.imageUrl ? [s.imageUrl] : []);

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

        {/* ---------------- Delivery & Cities ---------------- */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Delivery &amp; Cities</h2>
          <p className="mt-1 text-sm text-muted">
            Manage the cities you deliver to (shown on the storefront) and the reusable city list used when creating customers.
          </p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <CityListEditor
              label="Delivery cities"
              hint="Shown in the “We deliver to” section on the public website."
              value={settings.deliveryCities ?? []}
              onChange={(v) => set("deliveryCities", v)}
            />
            <CityListEditor
              label="Customer cities"
              hint="Pick-list for the city field when adding customers or invoices — keeps every city spelled the same so search always finds them."
              value={settings.customerCities ?? []}
              onChange={(v) => set("customerCities", v)}
            />
          </div>
        </div>

        {/* ---------------- Branding & Logos ---------------- */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Branding &amp; Logos</h2>
          <p className="mt-1 text-sm text-muted">
            Upload transparent PNG logos. The <strong>element</strong> logo is your icon/symbol; the{" "}
            <strong>name</strong> logo is your wordmark. Manage them here for the rebrand.
          </p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {/* Element (icon) logo */}
            <div>
              <span className="text-sm font-semibold">Element logo (icon / symbol)</span>
              <p className="text-xs text-muted">Your mark on its own. Transparent PNG recommended.</p>
              <div className="mt-2 flex items-center gap-3">
                {settings.elementLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.elementLogoUrl} alt="Element logo" className="h-16 w-16 rounded-xl border border-line bg-background object-contain p-1.5" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-line text-muted">
                    <UploadIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold">
                    {uploadingKey === "element-logo" ? "Uploading…" : settings.elementLogoUrl ? "Replace logo" : "Upload logo"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingKey !== null}
                      onChange={(e) => handleUpload("element-logo", e.currentTarget, (url) => set("elementLogoUrl", url))} />
                  </label>
                  {settings.elementLogoUrl && (
                    <button type="button" onClick={() => set("elementLogoUrl", "")} className="cursor-pointer text-left text-xs font-semibold text-red-400 hover:underline">
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Name (wordmark) logo */}
            <div>
              <span className="text-sm font-semibold">Name logo (wordmark)</span>
              <p className="text-xs text-muted">Your business name as a logo. Transparent PNG recommended.</p>
              <div className="mt-2 flex items-center gap-3">
                {settings.nameLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.nameLogoUrl} alt="Name logo" className="h-16 w-36 rounded-xl border border-line bg-background object-contain p-1.5" />
                ) : (
                  <div className="flex h-16 w-36 items-center justify-center rounded-xl border border-dashed border-line text-muted">
                    <UploadIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold">
                    {uploadingKey === "name-logo" ? "Uploading…" : settings.nameLogoUrl ? "Replace logo" : "Upload logo"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingKey !== null}
                      onChange={(e) => handleUpload("name-logo", e.currentTarget, (url) => set("nameLogoUrl", url))} />
                  </label>
                  {settings.nameLogoUrl && (
                    <button type="button" onClick={() => set("nameLogoUrl", "")} className="cursor-pointer text-left text-xs font-semibold text-red-400 hover:underline">
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
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
                <div className="mt-3 space-y-3">
                  {/* Photos — customers can switch between these on the storefront */}
                  <div>
                    <label className="text-sm font-semibold">Photos <span className="font-normal text-muted">(add several — customers switch between them)</span></label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {imagesOf(slot).map((src, idx) => (
                        <div key={idx} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
                          <button
                            type="button"
                            aria-label="Remove photo"
                            onClick={() => {
                              const next = imagesOf(slot).filter((_, j) => j !== idx);
                              setSaleItem(i, { images: next, imageUrl: next[0] ?? "" });
                            }}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line text-muted transition-colors duration-200 hover:border-gold hover:text-gold">
                        {uploadingKey === `sale-${i}` ? "…" : <UploadIcon className="h-5 w-5" />}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingKey !== null}
                          onChange={(e) =>
                            handleUpload(`sale-${i}`, e.currentTarget, (url) => {
                              const next = [...imagesOf(slot), url];
                              setSaleItem(i, { images: next, imageUrl: next[0] });
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
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
                  {(slot.title || slot.subtitle || imagesOf(slot).length > 0) && (
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

function CityListEditor({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (v && !value.some((c) => c.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setText("");
  };
  return (
    <div>
      <span className="text-sm font-semibold">{label}</span>
      <p className="text-xs text-muted">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {value.length === 0 && <span className="text-xs text-muted">No cities yet.</span>}
        {value.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
            {c}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={`Remove ${c}`}
              className="cursor-pointer text-red-400 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a city…"
          className="flex-1 rounded-xl border border-line bg-background px-3 py-2 text-sm focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40"
        />
        <button
          type="button"
          onClick={add}
          className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
        >
          Add
        </button>
      </div>
    </div>
  );
}
