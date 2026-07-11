import { MARKETING_SOURCES, type MarketingSource } from "@/lib/marketing";

// Shared shaping for invoice/quotation payloads: line items + totals.
// Items may reference a registered product (productId) or be free-form text.
export type LineItem = {
  productId: string | null;
  name: string;
  price: number;
  qty: number;
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

  return {
    items,
    subtotal,
    discount,
    tax,
    total,
    customerName: String(body.customerName ?? "").trim(),
    customerPhone: String(body.customerPhone ?? "").trim(),
    customerId: body.customerId || null,
    source,
    notes: String(body.notes ?? ""),
  };
}
