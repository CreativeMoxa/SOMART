import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MARKETING_SOURCES } from "@/lib/marketing";
import { CUSTOMER_TYPES, DEFAULT_CUSTOMER_TYPE } from "@/lib/customerType";
import { documentLineFields } from "@/models/lineItem";
import { auditFields } from "@/lib/auditFields";

export const QUOTATION_STATUSES = ["draft", "sent", "approved", "rejected"] as const;

const quotationSchema = new Schema(
  {
    ...auditFields,
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
    totalCost: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    status: { type: String, enum: QUOTATION_STATUSES, default: "draft" },
    source: { type: String, enum: MARKETING_SOURCES, default: "walk-in" },
    customerType: { type: String, enum: CUSTOMER_TYPES, default: DEFAULT_CUSTOMER_TYPE },
    validUntil: { type: String, default: "" },
    notes: { type: String, default: "" },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
  },
  { timestamps: true }
);

quotationSchema.index({ createdAt: -1 });

export type QuotationDoc = InferSchemaType<typeof quotationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Quotation: Model<QuotationDoc> =
  mongoose.models.Quotation ||
  mongoose.model<QuotationDoc>("Quotation", quotationSchema);
