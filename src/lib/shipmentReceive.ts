import type { HydratedDocument } from "mongoose";
import { Product, PRODUCT_CATEGORIES, type ProductVariant } from "@/models/Product";
import type { ShipmentDoc } from "@/models/Shipment";
import { applyStock } from "@/lib/inventory";

type ShipmentDocument = HydratedDocument<ShipmentDoc>;
type ShipmentItem = ShipmentDocument["items"][number];

// Add incoming variant counts onto the product's existing breakdown, matching
// by colour name (case-insensitive) and appending anything new.
function mergeVariants(
  existing: ProductVariant[] | undefined,
  incoming: ProductVariant[] | undefined
): ProductVariant[] {
  const out: ProductVariant[] = (existing ?? []).map((v) => ({
    name: v.name,
    qty: Number(v.qty) || 0,
  }));
  for (const inc of incoming ?? []) {
    const name = String(inc.name ?? "").trim();
    if (!name) continue;
    const match = out.find((v) => v.name.toLowerCase() === name.toLowerCase());
    if (match) match.qty += Number(inc.qty) || 0;
    else out.push({ name, qty: Number(inc.qty) || 0 });
  }
  return out;
}

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
      link1688: item.link1688 || "",
      imageUrl: item.imageUrl || "",
      images: item.imageUrl ? [item.imageUrl] : [],
      variants: (item.variants ?? []).map((v) => ({ name: v.name, qty: Number(v.qty) || 0 })),
      minStock: item.minStock ?? 5,
      stockQty: 0,
      inStock: false,
    });
    item.productId = product._id;
  } else {
    // Fill gaps on the existing product from the shipment line.
    if ((product.costPrice ?? 0) === 0 && item.costPrice) product.costPrice = item.costPrice;
    if ((product.price ?? 0) === 0 && item.sellingPrice) product.price = item.sellingPrice;
    if (!product.link1688 && item.link1688) product.link1688 = item.link1688;
    if (!product.imageUrl && item.imageUrl) {
      product.imageUrl = item.imageUrl;
      if (!product.images?.length) product.images = [item.imageUrl];
    }
    // Roll this line's colour counts onto the product's breakdown.
    if ((item.variants ?? []).length > 0) {
      product.set("variants", mergeVariants(product.variants, item.variants));
    }
  }

  await applyStock(product, item.qty, movementType, {
    reference: shipment.number,
    bumpRestocked: true,
    note: item.trackingNumber ? `${item.name} · track ${item.trackingNumber}` : item.name,
  });

  item.received = true;
  item.receivedAt = new Date();
  // The tracking number is only needed in transit — once the product is in
  // inventory it is cleared from the shipment line.
  item.trackingNumber = "";
}

// Reverse a received line (product missing / mistake): pull the stock back out
// of inventory and log the reversal. The shipment line stays intact.
export async function unreceiveItem(shipment: ShipmentDocument, item: ShipmentItem) {
  if (!item.received) return;
  const movementType = shipment.freightType === "sea" ? "unreceived-sea" : "unreceived-air";

  if (item.productId) {
    const product = await Product.findById(item.productId);
    if (product) {
      // Pull this line's colour counts back out of the breakdown.
      if ((item.variants ?? []).length > 0 && (product.variants ?? []).length > 0) {
        for (const inc of item.variants) {
          const match = product.variants.find(
            (v) => v.name.toLowerCase() === String(inc.name ?? "").trim().toLowerCase()
          );
          if (match) match.qty = Math.max(0, (Number(match.qty) || 0) - (Number(inc.qty) || 0));
        }
      }
      await applyStock(product, -item.qty, movementType, {
        reference: shipment.number,
        note: item.name,
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
