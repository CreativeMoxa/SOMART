import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { DEFAULT_TEMPLATES } from "@/lib/templates";

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "business" },
    companyName: { type: String, default: "SOMART" },
    tagline: { type: String, default: "Eyewear & Fashion Accessories" },
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
    // Homepage "Sale" section — up to 3 custom slots (photo + title + text).
    // Not tied to catalogue products; each links customers to WhatsApp.
    saleItems: {
      type: [
        {
          _id: false,
          imageUrl: { type: String, default: "" },
          title: { type: String, default: "" },
          subtitle: { type: String, default: "" },
        },
      ],
      default: [],
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
