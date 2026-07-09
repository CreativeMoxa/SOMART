import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export type CustomerDoc = InferSchemaType<typeof customerSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Customer: Model<CustomerDoc> =
  mongoose.models.Customer ||
  mongoose.model<CustomerDoc>("Customer", customerSchema);
