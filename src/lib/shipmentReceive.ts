import type { HydratedDocument } from "mongoose";
import { Product, PRODUCT_CATEGORIES } from "@/models/Product";
import type { ShipmentDoc } from "@/models/Shipment";
import { applyStock } from "@/lib/inventory";

type ShipmentDocument = HydratedDocument<ShipmentDoc>;
type ShipmentItem = ShipmentDocument["items"][number];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Receive ONE shipment line into store inventory: link or create the product
// (using the silent product info captured on the line), add stock, log history.
export async function receiveItem(shipment: ShipmentDocument, item: ShipmentItem) {
  if (item.received) return;
  const movementType = shipment.freightType === "sea" ? "received-sea" : "received-air";

  let product = item.productId ? await Product.findById(item.productId) : null;

  if (!product) {
    const category = PRODUCT_CATEGORIES.includes(
      item.category as (typeof PRODUCT_CATEGORIES)[number]
    )
      ? item.category
      : "accessories";
    const base = slugify(item.name) || "product";
    let slug = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await Product.exists({ slug });
      if (!exists) break;
      slug = `${base}-${Date.now().toString(36).slice(-4)}${attempt}`;
    }
    product = await Product.create({
      name: item.name,
      slug,
      brand: item.brand || "Imported",
      category,
      price: item.sellingPrice || item.costPrice || 0,
      costPrice: item.costPrice || 0,
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      images: item.imageUrl ? [item.imageUrl] : [],
      minStock: item.minStock ?? 5,
      stockQty: 0,
      inStock: false,
    });
    item.productId = product._id;
  } else {
    // Fill gaps on the existing product from the shipment line.
    if ((product.costPrice ?? 0) === 0 && item.costPrice) product.costPrice = item.costPrice;
    if ((product.price ?? 0) === 0 && item.sellingPrice) product.price = item.sellingPrice;
    if (!product.imageUrl && item.imageUrl) {
      product.imageUrl = item.imageUrl;
      if (!product.images?.length) product.images = [item.imageUrl];
    }
  }

  await applyStock(product, item.qty, movementType, {
    reference: shipment.number,
    bumpRestocked: true,
    note: item.trackingNumber ? `${item.name} · track ${item.trackingNumber}` : item.name,
  });

  item.received = true;
  item.receivedAt = new Date();
}

// Reverse a received line (product missing / mistake): pull the stock back out
// of inventory and log the reversal. The shipment line stays intact.
export async function unreceiveItem(shipment: ShipmentDocument, item: ShipmentItem) {
  if (!item.received) return;
  const movementType = shipment.freightType === "sea" ? "unreceived-sea" : "unreceived-air";

  if (item.productId) {
    const product = await Product.findById(item.productId);
    if (product) {
      await applyStock(product, -item.qty, movementType, {
        reference: shipment.number,
        note: item.trackingNumber ? `${item.name} · track ${item.trackingNumber}` : item.name,
      });
    }
  }

  item.received = false;
  item.receivedAt = null;
}

// Keep the shipment's status in sync with its items after a receive change.
export function syncShipmentStatus(shipment: ShipmentDocument) {
  const total = shipment.items.length;
  const received = shipment.items.filter((i) => i.received).length;
  if (total > 0 && received === total) {
    shipment.status = "received";
    shipment.receivedAt = shipment.receivedAt ?? new Date();
  } else if (shipment.status === "received") {
    // No longer fully received.
    shipment.status = received > 0 ? "arrived" : "in-transit";
    shipment.receivedAt = null;
  }
}
