import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { auditFields } from "@/lib/auditFields";

// Money the business OWES to other people for reasons that are NOT customer
// sales/invoices (borrowed money, money held for someone, a bill someone paid
// on the business's behalf). Only unpaid obligations count against the balance.
const obligationSchema = new Schema(
  {
    ...auditFields,
    description: { type: String, required: true, trim: true }, // person / description
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, default: "" }, // YYYY-MM-DD
    reason: { type: String, default: "" },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
  },
  { timestamps: true }
);

obligationSchema.index({ status: 1, createdAt: -1 });

export type ObligationDoc = InferSchemaType<typeof obligationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Obligation: Model<ObligationDoc> =
  mongoose.models.Obligation || mongoose.model<ObligationDoc>("Obligation", obligationSchema);
