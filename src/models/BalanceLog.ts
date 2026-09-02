import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Audit trail for every Business Balance change — who changed which channel,
// from what to what, and when.
const balanceLogSchema = new Schema(
  {
    method: { type: String, required: true }, // zaad / slcash / edahab / ebirr / premier
    previousAmount: { type: Number, default: 0 },
    newAmount: { type: Number, default: 0 },
    adjustment: { type: Number, default: 0 }, // new - previous
    by: { type: String, default: "" },
  },
  { timestamps: true }
);

balanceLogSchema.index({ createdAt: -1 });

export type BalanceLogDoc = InferSchemaType<typeof balanceLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BalanceLog: Model<BalanceLogDoc> =
  mongoose.models.BalanceLog || mongoose.model<BalanceLogDoc>("BalanceLog", balanceLogSchema);
