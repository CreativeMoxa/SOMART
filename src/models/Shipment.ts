import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { FREIGHT_TYPES, SHIPMENT_STATUSES } from "@/lib/freight";

// One shipment (Air or Sea) of incoming products. This is NOT store inventory —
// stock only moves into products when the shipment is Received.
const shipmentItemFields = {
  productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
  name: { type: String, required: true },
  imageUrl: { type: String, default: "" },
  link1688: { type: String, default: "" },
  // Every product travels with its own tracking number.
  trackingNumber: { type: String, default: "" },
  qty: { type: Number, required: true, min: 1 },
  // Colour/size variants for this line, e.g. White 30, Blue 30. When present,
  // qty is the sum of these. Rolled onto the product on receive.
  variants: {
    type: [{ _id: false, name: { type: String, default: "" }, qty: { type: Number, default: 0, min: 0 } }],
    default: [],
  },
  costPrice: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, default: 0, min: 0 },
  // Silent product info — used to build the store product on receive
  // (not shown on printed documents, like the marketing field on invoices).
  brand: { type: String, default: "" },
  category: { type: String, default: "" },
  minStock: { type: Number, default: 5, min: 0 },
  description: { type: String, default: "" },
  note: { type: String, default: "" },
  // Per-item receive verification: arrived items are checked in one by one.
  received: { type: Boolean, default: false },
  receivedAt: { type: Date, default: null },
};

const shipmentSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    freightType: { type: String, enum: FREIGHT_TYPES, required: true, index: true },
    name: { type: String, default: "" },
    // The cargo/forwarder company carrying this shipment (reusable, like customers).
    cargo: { type: String, default: "" },
    trackingNumber: { type: String, default: "" }, // legacy shipment-level tracking
    shippingDate: { type: String, default: "" },
    expectedArrival: { type: String, default: "" },
    status: { type: String, enum: SHIPMENT_STATUSES, default: "preparing" },
    notes: { type: String, default: "" },
    items: { type: [shipmentItemFields], default: [] },
    totalQty: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    expectedSalesValue: { type: Number, default: 0 },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shipmentSchema.index({ freightType: 1, createdAt: -1 });
shipmentSchema.index({ status: 1 });

export type ShipmentDoc = InferSchemaType<typeof shipmentSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Shipment: Model<ShipmentDoc> =
  mongoose.models.Shipment || mongoose.model<ShipmentDoc>("Shipment", shipmentSchema);
