import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { DEFAULT_TEMPLATES } from "@/lib/templates";

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "business" },
    companyName: { type: String, default: "SOMART" },
    tagline: { type: String, default: "Eyewear & Fashion Accessories" },
    // Brand logos (transparent PNGs): the "element" mark/icon and the "name"
    // wordmark. Managed in Settings; used across the system and documents.
    elementLogoUrl: { type: String, default: "" },
    nameLogoUrl: { type: String, default: "" },
    whatsappNumber: { type: String, default: "" },
    phone: { type: String, default: "" },
    salesPhone: { type: String, default: "" },
    operationsPhone: { type: String, default: "" },
    email: { type: String, default: "somartt.co@gmail.com" },
    website: { type: String, default: "" },
    address: { type: String, default: "" },
    businessHours: { type: String, default: "Mon–Sat: 9am – 7pm" },
    // Public-website controls (managed from admin → Settings → Public Website).
    heroImageUrl: { type: String, default: "" },
    heroImageTitle: { type: String, default: "" },
    heroImageSubtitle: { type: String, default: "" },
    // Hero "Community" button — link to your announcements group (WhatsApp,
    // Telegram, etc.). Empty falls back to a WhatsApp chat.
    communityUrl: { type: String, default: "" },
    // Homepage category stat numbers. Empty → a text-only line (no count).
    statWatches: { type: String, default: "" },
    statSunglasses: { type: String, default: "" },
    statAccessories: { type: String, default: "" },
    // Homepage "Sale" section — up to 3 custom slots (photo + title + text).
    // Not tied to catalogue products; each links customers to WhatsApp.
    saleItems: {
      type: [
        {
          _id: false,
          productId: { type: String, default: "" }, // link to a catalogue product (photos + name pulled from it)
          imageUrl: { type: String, default: "" }, // legacy single (= images[0])
          images: { type: [String], default: [] }, // multiple photos, switchable on the storefront
          title: { type: String, default: "" },
          subtitle: { type: String, default: "" },
        },
      ],
      default: [],
    },
    // Cities the shop delivers to (public storefront). Managed in Settings.
    deliveryCities: {
      type: [String],
      default: ["Hargeisa", "Mogadisho", "Djibouti", "Garowe", "Bosaso", "Erigavo", "Las'anod", "Berbera", "Burco", "Jigjiga", "Borama", "Diredawa"],
    },
    // Canonical city list reused when creating customers (customer module,
    // invoices, …) so the same city is always spelled the same way — searchable.
    customerCities: {
      type: [String],
      default: ["Hargeisa", "Mogadisho", "Djibouti", "Garowe", "Bosaso", "Berbera", "Burco", "Borama"],
    },
    currency: { type: String, default: "USD" },
    currencySymbol: { type: String, default: "$" },
    taxPercent: { type: Number, default: 0 },
    // Shown on invoices/quotations as the "on this account:" payment line.
    bankAccount: { type: String, default: "" },
    invoiceFooter: { type: String, default: "Thank you for your business!" },
    // Editable message templates ({placeholder} tokens, see src/lib/templates.ts)
    templateWhatsappProduct: { type: String, default: DEFAULT_TEMPLATES.whatsappProduct },
    templateWhatsappDocument: { type: String, default: DEFAULT_TEMPLATES.whatsappDocument },
  },
  { timestamps: true }
);

export type SettingDoc = InferSchemaType<typeof settingSchema>;

export const Setting: Model<SettingDoc> =
  mongoose.models.Setting || mongoose.model<SettingDoc>("Setting", settingSchema);

export async function getSettings(): Promise<SettingDoc> {
  const existing = await Setting.findOne({ key: "business" }).lean<SettingDoc>();
  if (existing) return existing;
  return (await Setting.create({ key: "business" })).toObject() as SettingDoc;
}
