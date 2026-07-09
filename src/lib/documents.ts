// Shared shaping for invoice/quotation payloads: free-form line items + totals.
export type LineItem = { name: string; price: number; qty: number };

export function shapeDocumentPayload(body: Record<string, unknown>) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: LineItem[] = rawItems
    .map((i) => {
      const item = i as Partial<LineItem>;
      return {
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

  return {
    items,
    subtotal,
    discount,
    tax,
    total,
    customerName: String(body.customerName ?? "").trim(),
    customerPhone: String(body.customerPhone ?? "").trim(),
    customerId: body.customerId || null,
    notes: String(body.notes ?? ""),
  };
}
