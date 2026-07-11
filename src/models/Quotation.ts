import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MARKETING_SOURCES } from "@/lib/marketing";

export const QUOTATION_STATUSES = ["draft", "sent", "approved", "rejected"] as const;

const quotationSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: "" },
    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
          name: { type: String, required: true },
          price: { type: Number, required: true },
          qty: { type: Number, required: true, min: 1 },
        },
      ],
      required: true,
    },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: QUOTATION_STATUSES, default: "draft" },
    source: { type: String, enum: MARKETING_SOURCES, default: "walk-in" },
    validUntil: { type: String, default: "" },
    notes: { type: String, default: "" },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
  },
  { timestamps: true }
);

export type QuotationDoc = InferSchemaType<typeof quotationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Quotation: Model<QuotationDoc> =
  mongoose.models.Quotation ||
  mongoose.model<QuotationDoc>("Quotation", quotationSchema);
