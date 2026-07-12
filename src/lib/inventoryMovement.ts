// Every stock change is recorded as an inventory movement. Client-safe labels.

export const MOVEMENT_TYPES = [
  "received-air",
  "received-sea",
  "unreceived-air",
  "unreceived-sea",
  "manual-receive",
  "manual-adjustment",
  "stock-count",
  "write-off",
  "invoice-sale",
  "invoice-cancelled",
  "invoice-returned",
  "product-created",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  "received-air": "Received from Air Freight",
  "received-sea": "Received from Sea Freight",
  "unreceived-air": "Returned to Air Freight",
  "unreceived-sea": "Returned to Sea Freight",
  "manual-receive": "Manual Stock Received",
  "manual-adjustment": "Manual Stock Adjustment",
  "stock-count": "Stock Count",
  "write-off": "Write Off",
  "invoice-sale": "Invoice Sale",
  "invoice-cancelled": "Invoice Cancelled",
  "invoice-returned": "Invoice Returned",
  "product-created": "Product Created",
};

// Manual actions available from the Store Inventory UI.
export const INVENTORY_ACTIONS = ["receive", "adjust", "count", "write-off"] as const;
export type InventoryAction = (typeof INVENTORY_ACTIONS)[number];
