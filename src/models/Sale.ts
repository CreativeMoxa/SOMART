import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const PAYMENT_METHODS = [
  "cash",
  "card",
  "mobile-money",
  "bank-transfer",
  "other",
] as const;

const saleSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product" },
          name: { type: String, required: true },
          price: { type: Number, required: true },
          costPrice: { type: Number, default: 0 },
          qty: { type: Number, required: true, min: 1 },
        },
      ],
      required: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, default: "Walk-in" },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    profit: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export type SaleDoc = InferSchemaType<typeof saleSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Sale: Model<SaleDoc> =
  mongoose.models.Sale || mongoose.model<SaleDoc>("Sale", saleSchema);
