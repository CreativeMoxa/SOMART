import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { auditFields } from "@/lib/auditFields";
import { phoneDigits } from "@/lib/phone";

const customerSchema = new Schema(
  {
    ...auditFields,
    // Stable, ever-increasing customer number (oldest = 1). A new customer
    // always takes the next number, never re-uses an old one.
    seq: { type: Number, default: 0, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    // Normalised phone digits (no country code / formatting) — kept in sync
    // below so search can match numbers however they're written, fast.
    phoneDigits: { type: String, default: "", index: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Keep the normalised digits in step with the phone on every save.
customerSchema.pre("save", function () {
  this.phoneDigits = phoneDigits(this.phone);
});

// Hot paths: directory list (newest first), phone dedupe on imports/saves.
customerSchema.index({ createdAt: -1 });
customerSchema.index({ phone: 1 });

export type CustomerDoc = InferSchemaType<typeof customerSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Customer: Model<CustomerDoc> =
  mongoose.models.Customer ||
  mongoose.model<CustomerDoc>("Customer", customerSchema);

// The next customer number = highest existing + 1 (never re-used).
export async function nextCustomerSeq(): Promise<number> {
  const last = await Customer.findOne().sort({ seq: -1 }).select("seq").lean();
  return ((last?.seq as number) ?? 0) + 1;
}
