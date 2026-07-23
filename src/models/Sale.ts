import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MARKETING_SOURCES } from "@/lib/marketing";
import { CUSTOMER_TYPES, DEFAULT_CUSTOMER_TYPE } from "@/lib/customerType";
import { documentLineFields } from "@/models/lineItem";
import { auditFields } from "@/lib/auditFields";

export const PAYMENT_METHODS = [
  "cash",
  "card",
  "mobile-money",
  "bank-transfer",
  "other",
] as const;

// completed = real sale, inventory deducted; pending = awaiting payment, inventory untouched.
export const SALE_STATUSES = ["completed", "pending"] as const;

const saleSchema = new Schema(
  {
    ...auditFields,
    number: { type: String, required: true, unique: true },
    items: { type: [documentLineFields], required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, default: "Walk-in" },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    // Profit inherited from the invoice (or computed for direct sales).
    totalCost: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    status: { type: String, enum: SALE_STATUSES, default: "completed" },
    source: { type: String, enum: MARKETING_SOURCES, default: "walk-in" },
    customerType: { type: String, enum: CUSTOMER_TYPES, default: DEFAULT_CUSTOMER_TYPE },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

// Hot paths: recent-sales lists, dashboard revenue (status+date), marketing rollups.
saleSchema.index({ createdAt: -1 });
saleSchema.index({ status: 1, createdAt: -1 });
saleSchema.index({ source: 1 });

export type SaleDoc = InferSchemaType<typeof saleSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Sale: Model<SaleDoc> =
  mongoose.models.Sale || mongoose.model<SaleDoc>("Sale", saleSchema);
