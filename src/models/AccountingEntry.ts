import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { auditFields } from "@/lib/auditFields";
import { PAYMENT_METHODS } from "@/lib/payment";

// A MANUAL accounting entry — for money that doesn't come from the sales/invoice
// or expenses modules (e.g. owner top-up, a one-off income, a correction). The
// Accounting module reads automatic income from completed Sales and automatic
// expenses from the Expenses module; these entries are the manual additions.
export const ACCOUNTING_ENTRY_TYPES = ["income", "expense", "adjustment"] as const;
export type AccountingEntryType = (typeof ACCOUNTING_ENTRY_TYPES)[number];

const accountingEntrySchema = new Schema(
  {
    ...auditFields,
    date: { type: String, required: true }, // YYYY-MM-DD (immutable record date)
    description: { type: String, required: true, trim: true },
    type: { type: String, enum: ACCOUNTING_ENTRY_TYPES, required: true },
    // For income/expense: a positive magnitude. For adjustment: signed (+/-).
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

accountingEntrySchema.index({ date: -1 });
accountingEntrySchema.index({ type: 1, date: -1 });

export type AccountingEntryDoc = InferSchemaType<typeof accountingEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AccountingEntry: Model<AccountingEntryDoc> =
  mongoose.models.AccountingEntry ||
  mongoose.model<AccountingEntryDoc>("AccountingEntry", accountingEntrySchema);
