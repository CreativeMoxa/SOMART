// Air & Sea freight share one workflow, distinguished by freightType.
// Client-safe (no DB imports).

export const FREIGHT_TYPES = ["air", "sea"] as const;
export type FreightType = (typeof FREIGHT_TYPES)[number];

export const FREIGHT_META: Record<
  FreightType,
  { label: string; singular: string; prefix: string; path: string }
> = {
  air: { label: "Air Freight", singular: "Air Freight Shipment", prefix: "AIR", path: "air-freight" },
  sea: { label: "Sea Freight", singular: "Sea Freight Shipment", prefix: "SEA", path: "sea-freight" },
};

export const SHIPMENT_STATUSES = [
  "preparing",
  "shipped",
  "in-transit",
  "arrived",
  "received",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  preparing: "Preparing",
  shipped: "Shipped",
  "in-transit": "In Transit",
  arrived: "Arrived",
  received: "Received",
};

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  preparing: "bg-surface text-muted",
  shipped: "bg-sky-500/15 text-sky-500",
  "in-transit": "bg-amber-500/15 text-amber-500",
  arrived: "bg-violet-500/15 text-violet-500",
  received: "bg-emerald-500/15 text-emerald-500",
};
