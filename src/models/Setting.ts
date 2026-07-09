import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "business" },
    companyName: { type: String, default: "SOMART" },
    tagline: { type: String, default: "Eyewear & Fashion Accessories" },
    whatsappNumber: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    currency: { type: String, default: "USD" },
    currencySymbol: { type: String, default: "$" },
    taxPercent: { type: Number, default: 0 },
    invoiceFooter: { type: String, default: "Thank you for your business!" },
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
