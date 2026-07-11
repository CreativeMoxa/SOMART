import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

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
    inStock: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type ProductDoc = InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId;
};

export function salePrice(p: { price: number; discountPercent?: number }) {
  const pct = p.discountPercent ?? 0;
  return pct > 0 ? Math.round(p.price * (100 - pct)) / 100 : p.price;
}

export const Product: Model<ProductDoc> =
  mongoose.models.Product || mongoose.model<ProductDoc>("Product", productSchema);
