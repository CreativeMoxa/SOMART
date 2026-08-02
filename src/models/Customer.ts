import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { auditFields } from "@/lib/auditFields";
import { phoneDigits } from "@/lib/phone";

const customerSchema = new Schema(
  {
    ...auditFields,
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
