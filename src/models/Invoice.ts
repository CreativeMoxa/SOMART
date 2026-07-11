import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MARKETING_SOURCES } from "@/lib/marketing";

export const INVOICE_STATUSES = ["draft", "unpaid", "paid", "overdue"] as const;

const invoiceSchema = new Schema(
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
    status: { type: String, enum: INVOICE_STATUSES, default: "draft" },
    source: { type: String, enum: MARKETING_SOURCES, default: "walk-in" },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", default: null },
    dueDate: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Hot paths: invoice list (newest first), status filters/counts.
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ status: 1 });

export type InvoiceDoc = InferSchemaType<typeof invoiceSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Invoice: Model<InvoiceDoc> =
  mongoose.models.Invoice || mongoose.model<InvoiceDoc>("Invoice", invoiceSchema);
