import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MARKETING_SOURCES } from "@/lib/marketing";
import { CUSTOMER_TYPES, DEFAULT_CUSTOMER_TYPE } from "@/lib/customerType";
import { PAYMENT_METHODS } from "@/models/Sale";
import { documentLineFields } from "@/models/lineItem";

export const INVOICE_STATUSES = ["draft", "unpaid", "paid", "overdue"] as const;

const invoiceSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: "" },
    customerAddress: { type: String, default: "" },
    items: { type: [documentLineFields], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    // Profit snapshot at time of sale (see src/lib/profit.ts).
    totalCost: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: "draft" },
    // Payment method chosen when billing — inherited by the Sale on payment.
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    source: { type: String, enum: MARKETING_SOURCES, default: "walk-in" },
    customerType: { type: String, enum: CUSTOMER_TYPES, default: DEFAULT_CUSTOMER_TYPE },
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
