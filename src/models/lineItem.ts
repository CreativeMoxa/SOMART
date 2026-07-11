import { Schema } from "mongoose";

// Shared line-item shape for invoices, quotations and sales. Every line carries
// a profit snapshot (cost/selling/markup/margin) plus category & brand so that
// historical documents and reports stay accurate even if the product changes
// or is deleted later.
export const documentLineFields = {
  productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
  name: { type: String, required: true },
  price: { type: Number, required: true }, // selling price, per unit
  qty: { type: Number, required: true, min: 1 },
  costPrice: { type: Number, default: 0 }, // per unit, snapshot
  profitAmount: { type: Number, default: 0 }, // per unit = price - costPrice
  markupPercent: { type: Number, default: 0 },
  marginPercent: { type: Number, default: 0 },
  category: { type: String, default: "" },
  brand: { type: String, default: "" },
};
