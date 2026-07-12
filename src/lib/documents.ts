import { MARKETING_SOURCES, type MarketingSource } from "@/lib/marketing";
import {
  CUSTOMER_TYPES,
  DEFAULT_CUSTOMER_TYPE,
  type CustomerType,
} from "@/lib/customerType";
import { PAYMENT_METHODS } from "@/models/Sale";
import { Product } from "@/models/Product";
import { computeProfit, round2 } from "@/lib/profit";

// Shared shaping for invoice/quotation payloads: line items + totals.
// Items may reference a registered product (productId) or be free-form text.
export type LineItem = {
  productId: string | null;
  name: string;
  price: number;
  qty: number;
};

// A line enriched with the profit snapshot stored on the document.
export type EnrichedLineItem = LineItem & {
  costPrice: number;
  profitAmount: number;
  markupPercent: number;
  marginPercent: number;
  category: string;
  brand: string;
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export function shapeDocumentPayload(body: Record<string, unknown>) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: LineItem[] = rawItems
    .map((i) => {
      const item = i as Partial<LineItem>;
      const productId = String(item.productId ?? "");
      return {
        productId: OBJECT_ID.test(productId) ? productId : null,
        name: String(item.name ?? "").trim(),
        price: Math.max(0, Number(item.price) || 0),
        qty: Math.max(1, Math.floor(Number(item.qty) || 1)),
      };
    })
    .filter((i) => i.name);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discount = Math.max(0, Number(body.discount) || 0);
  const tax = Math.max(0, Number(body.tax) || 0);
  const total = Math.max(0, subtotal - discount + tax);

  const source = MARKETING_SOURCES.includes(body.source as MarketingSource)
    ? (body.source as MarketingSource)
    : "walk-in";
  const customerType = CUSTOMER_TYPES.includes(body.customerType as CustomerType)
    ? (body.customerType as CustomerType)
    : DEFAULT_CUSTOMER_TYPE;
  const paymentMethod = (PAYMENT_METHODS as readonly string[]).includes(
    body.paymentMethod as string
  )
    ? (body.paymentMethod as string)
    : "cash";

  return {
    items,
    subtotal,
    discount,
    tax,
    total,
    customerName: String(body.customerName ?? "").trim(),
    customerPhone: String(body.customerPhone ?? "").trim(),
    customerAddress: String(body.customerAddress ?? "").trim(),
    customerId: body.customerId || null,
    source,
    customerType,
    paymentMethod,
    notes: String(body.notes ?? ""),
  };
}

// Snapshot cost/profit/category/brand onto each line by looking up the product.
// Runs server-side so cost prices are trusted (never sent from the client) and
// frozen at document creation for historical accuracy.
export async function enrichItemsWithProfit(
  items: LineItem[],
  discount = 0
): Promise<{
  items: EnrichedLineItem[];
  totalCost: number;
  profit: number;
}> {
  const ids = items
    .map((i) => i.productId)
    .filter((id): id is string => Boolean(id));
  const products = ids.length
    ? await Product.find({ _id: { $in: ids } })
        .select("costPrice category brand")
        .lean()
    : [];
  const byId = new Map(products.map((p) => [String(p._id), p]));

  let totalCost = 0;
  let grossProfit = 0;
  const enriched = items.map((i) => {
    const p = i.productId ? byId.get(i.productId) : undefined;
    const costPrice = p ? Math.max(0, p.costPrice ?? 0) : 0;
    const { profitAmount, markupPercent, marginPercent } = computeProfit(
      i.price,
      costPrice
    );
    totalCost += costPrice * i.qty;
    grossProfit += profitAmount * i.qty;
    return {
      ...i,
      costPrice,
      profitAmount,
      markupPercent,
      marginPercent,
      category: p?.category ?? "",
      brand: p?.brand ?? "",
    };
  });

  return {
    items: enriched,
    totalCost: round2(totalCost),
    // Discount reduces realised profit (matches the Sales convention).
    profit: round2(grossProfit - (Number(discount) || 0)),
  };
}
