import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MOVEMENT_TYPES } from "@/lib/inventoryMovement";

// Permanent audit log of every stock change. Records are never edited or
// deleted — they are the source of truth for stock history and movement reports.
const movementSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", index: true },
    productName: { type: String, default: "" },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    qtyBefore: { type: Number, required: true },
    qtyChange: { type: Number, required: true },
    qtyAfter: { type: Number, required: true },
    reference: { type: String, default: "" },
    note: { type: String, default: "" },
    user: { type: String, default: "admin" },
  },
  { timestamps: true }
);

movementSchema.index({ createdAt: -1 });
movementSchema.index({ productId: 1, createdAt: -1 });
movementSchema.index({ type: 1, createdAt: -1 });

export type InventoryMovementDoc = InferSchemaType<typeof movementSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const InventoryMovement: Model<InventoryMovementDoc> =
  mongoose.models.InventoryMovement ||
  mongoose.model<InventoryMovementDoc>("InventoryMovement", movementSchema);
