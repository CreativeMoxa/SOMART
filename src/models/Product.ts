import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { computeProfit } from "@/lib/profit";

export const PRODUCT_CATEGORIES = [
  "eyeglasses",
  "sunglasses",
  "watches",
  "accessories",
] as const;

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    brand: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: PRODUCT_CATEGORIES,
      index: true,
    },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 90 },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    images: { type: [String], default: [] },
    specs: {
      type: [{ label: String, value: String }],
      default: [],
    },
    colors: { type: [String], default: [] },
    material: { type: String, default: "" },
    gender: {
      type: String,
      enum: ["men", "women", "unisex", "kids"],
      default: "unisex",
    },
    stockQty: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 5, min: 0 }, // low-stock threshold
    inStock: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0 },
    lastRestockedAt: { type: Date, default: null },
    lastSoldAt: { type: Date, default: null },
    featured: { type: Boolean, default: false },
    // When false the product is hidden from the public website (shop, homepage,
    // detail page) but stays fully visible/usable in the admin.
    visible: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Calculated business fields, derived automatically from price & costPrice.
// (profitAmount / markupPercent / marginPercent — see src/lib/profit.ts)
productSchema.virtual("profitAmount").get(function () {
  return computeProfit(this.price ?? 0, this.costPrice ?? 0).profitAmount;
});
productSchema.virtual("markupPercent").get(function () {
  return computeProfit(this.price ?? 0, this.costPrice ?? 0).markupPercent;
});
productSchema.virtual("marginPercent").get(function () {
  return computeProfit(this.price ?? 0, this.costPrice ?? 0).marginPercent;
});

export type ProductDoc = InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId;
  profitAmount: number;
  markupPercent: number;
  marginPercent: number;
};

export function salePrice(p: { price: number; discountPercent?: number }) {
  const pct = p.discountPercent ?? 0;
  return pct > 0 ? Math.round(p.price * (100 - pct)) / 100 : p.price;
}

export const Product: Model<ProductDoc> =
  mongoose.models.Product || mongoose.model<ProductDoc>("Product", productSchema);
