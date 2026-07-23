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
    // Supplier links (e.g. 1688) carried over from freight shipment lines.
    // Internal/admin only — never shown on the public storefront.
    // `link1688` is the legacy single link, kept in sync as links1688[0].
    link1688: { type: String, default: "" },
    links1688: { type: [String], default: [] },
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
    // Colour/size variants with per-variant counts, e.g. White 30, Blue 30.
    // When present, stockQty is kept as the sum of variant counts. Selling still
    // deducts from the overall stockQty (variants are a breakdown + display).
    variants: {
      type: [{ _id: false, name: { type: String, default: "" }, qty: { type: Number, default: 0, min: 0 } }],
      default: [],
    },
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

export type ProductVariant = { name: string; qty: number };

// Normalise a raw variants array: keep only named rows, clamp qty ≥ 0.
export function cleanVariants(raw: unknown): ProductVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => ({
      name: String((v as ProductVariant)?.name ?? "").trim(),
      qty: Math.max(0, Math.floor(Number((v as ProductVariant)?.qty) || 0)),
    }))
    .filter((v) => v.name);
}

export function sumVariants(variants: ProductVariant[] | undefined | null): number {
  return (variants ?? []).reduce((s, v) => s + (Number(v.qty) || 0), 0);
}

// Normalise supplier links: trim, drop blanks, de-duplicate. Falls back to the
// legacy single `link1688` so older records keep working.
export function cleanLinks(raw: unknown, legacy?: unknown): string[] {
  const arr = Array.isArray(raw)
    ? raw.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  if (arr.length === 0) {
    const one = String(legacy ?? "").trim();
    if (one) return [one];
  }
  return [...new Set(arr)];
}

export function salePrice(p: { price: number; discountPercent?: number }) {
  const pct = p.discountPercent ?? 0;
  return pct > 0 ? Math.round(p.price * (100 - pct)) / 100 : p.price;
}

export const Product: Model<ProductDoc> =
  mongoose.models.Product || mongoose.model<ProductDoc>("Product", productSchema);
