import { Shipment } from "@/models/Shipment";
import { FREIGHT_META, SHIPMENT_STATUSES, type FreightType, type ShipmentStatus } from "@/lib/freight";
import { round2 } from "@/lib/profit";
import { cleanVariants, sumVariants } from "@/models/Product";

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export type ShipmentItemInput = {
  productId?: string | null;
  name?: unknown;
  imageUrl?: unknown;
  link1688?: unknown;
  trackingNumber?: unknown;
  qty?: unknown;
  variants?: unknown;
  costPrice?: unknown;
  sellingPrice?: unknown;
  brand?: unknown;
  category?: unknown;
  minStock?: unknown;
  description?: unknown;
  note?: unknown;
  received?: unknown;
  receivedAt?: unknown;
};

// Per-type sequential numbering: AIR-0001 / SEA-0001, independent counters.
export async function nextShipmentNumber(freightType: FreightType) {
  const count = await Shipment.countDocuments({ freightType });
  return `${FREIGHT_META[freightType].prefix}-${String(count + 1).padStart(4, "0")}`;
}

export function shapeShipmentPayload(body: Record<string, unknown>) {
  const rawItems = Array.isArray(body.items) ? (body.items as ShipmentItemInput[]) : [];
  const items = rawItems
    .map((i) => {
      const pid = String(i.productId ?? "");
      const variants = cleanVariants(i.variants);
      // With variants, the line qty is their sum; otherwise the typed qty.
      const qty =
        variants.length > 0
          ? Math.max(1, sumVariants(variants))
          : Math.max(1, Math.floor(Number(i.qty) || 1));
      const costPrice = Math.max(0, Number(i.costPrice) || 0);
      const sellingPrice = Math.max(0, Number(i.sellingPrice) || 0);
      const received = i.received === true;
      return {
        productId: OBJECT_ID.test(pid) ? pid : null,
        name: String(i.name ?? "").trim(),
        imageUrl: String(i.imageUrl ?? "").trim(),
        link1688: String(i.link1688 ?? "").trim(),
        trackingNumber: String(i.trackingNumber ?? "").trim(),
        qty,
        variants,
        costPrice,
        sellingPrice,
        brand: String(i.brand ?? "").trim(),
        category: String(i.category ?? "").trim(),
        minStock: Math.max(0, Math.floor(Number(i.minStock) || 5)),
        description: String(i.description ?? "").trim(),
        note: String(i.note ?? "").trim(),
        // Received lines pass through unchanged — the UI locks them, and stock
        // for them has already been moved.
        received,
        receivedAt: received && i.receivedAt ? new Date(String(i.receivedAt)) : null,
      };
    })
    .filter((i) => i.name);

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalCost = round2(items.reduce((s, i) => s + i.costPrice * i.qty, 0));
  const expectedSalesValue = round2(
    items.reduce((s, i) => s + i.sellingPrice * i.qty, 0)
  );

  const status = SHIPMENT_STATUSES.includes(body.status as ShipmentStatus)
    ? (body.status as ShipmentStatus)
    : "preparing";

  return {
    items,
    totalQty,
    totalCost,
    expectedSalesValue,
    status,
    name: String(body.name ?? "").trim(),
    cargo: String(body.cargo ?? "").trim(),
    trackingNumber: String(body.trackingNumber ?? "").trim(),
    shippingDate: String(body.shippingDate ?? "").trim(),
    expectedArrival: String(body.expectedArrival ?? "").trim(),
    notes: String(body.notes ?? ""),
  };
}
