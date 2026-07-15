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
    weeklyOfferProductIds: { type: [String], default: [] },
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

export async function getSettings() {
  let doc = await Setting.findOne({ key: "business" }).lean();
  if (!doc) {
    doc = (await Setting.create({ key: "business" })).toObject();
  }
  return doc;
}
