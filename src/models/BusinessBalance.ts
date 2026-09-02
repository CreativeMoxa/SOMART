import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Sensitive singleton: how much cash the business currently holds in each
// payment channel. Only ever read/written through the PIN-protected Business
// Balance API — never through the general settings endpoint.
export const BALANCE_METHODS = ["zaad", "slcash", "edahab", "ebirr", "premier"] as const;
export type BalanceMethod = (typeof BALANCE_METHODS)[number];

export const BALANCE_METHOD_LABELS: Record<BalanceMethod, string> = {
  zaad: "ZAAD $",
  slcash: "SL CASH",
  edahab: "EDAHAB",
  ebirr: "EBIRR",
  premier: "PREMIER WALLET",
};

const businessBalanceSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    zaad: { type: Number, default: 0 },
    slcash: { type: Number, default: 0 },
    edahab: { type: Number, default: 0 },
    ebirr: { type: Number, default: 0 },
    premier: { type: Number, default: 0 },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export type BusinessBalanceDoc = InferSchemaType<typeof businessBalanceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BusinessBalance: Model<BusinessBalanceDoc> =
  mongoose.models.BusinessBalance ||
  mongoose.model<BusinessBalanceDoc>("BusinessBalance", businessBalanceSchema);

export async function getBusinessBalance(): Promise<BusinessBalanceDoc> {
  const existing = await BusinessBalance.findOne({ key: "main" }).lean<BusinessBalanceDoc>();
  if (existing) return existing;
  return (await BusinessBalance.create({ key: "main" })).toObject() as BusinessBalanceDoc;
}
