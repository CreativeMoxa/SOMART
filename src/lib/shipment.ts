import { Shipment } from "@/models/Shipment";
import { FREIGHT_META, SHIPMENT_STATUSES, type FreightType, type ShipmentStatus } from "@/lib/freight";
import { round2 } from "@/lib/profit";

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export type ShipmentItemInput = {
  productId?: string | null;
  name?: unknown;
  imageUrl?: unknown;
  link1688?: unknown;
  qty?: unknown;
  costPrice?: unknown;
  sellingPrice?: unknown;
  category?: unknown;
  note?: unknown;
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
      const qty = Math.max(1, Math.floor(Number(i.qty) || 1));
      const costPrice = Math.max(0, Number(i.costPrice) || 0);
      const sellingPrice = Math.max(0, Number(i.sellingPrice) || 0);
      return {
        productId: OBJECT_ID.test(pid) ? pid : null,
        name: String(i.name ?? "").trim(),
        imageUrl: String(i.imageUrl ?? "").trim(),
        link1688: String(i.link1688 ?? "").trim(),
        qty,
        costPrice,
        sellingPrice,
        category: String(i.category ?? "").trim(),
        note: String(i.note ?? "").trim(),
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
    trackingNumber: String(body.trackingNumber ?? "").trim(),
    shippingDate: String(body.shippingDate ?? "").trim(),
    expectedArrival: String(body.expectedArrival ?? "").trim(),
    notes: String(body.notes ?? ""),
  };
}
