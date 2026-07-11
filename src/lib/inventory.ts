import type { HydratedDocument } from "mongoose";
import { InventoryMovement } from "@/models/InventoryMovement";
import type { ProductDoc } from "@/models/Product";
import type { MovementType } from "@/lib/inventoryMovement";

// The acting user for history. Single-admin system for now.
export function currentUser(): string {
  return process.env.ADMIN_USERNAME || "admin";
}

type ProductDocument = HydratedDocument<ProductDoc>;

type MovementOpts = {
  reference?: string;
  note?: string;
  user?: string;
  // Sales bump soldCount/lastSold; restocks bump lastRestocked.
  bumpSold?: boolean;
  bumpRestocked?: boolean;
};

// Append-only history entry. Never edited or removed.
export async function logMovement(params: {
  productId: unknown;
  productName: string;
  type: MovementType;
  qtyBefore: number;
  qtyChange: number;
  qtyAfter: number;
  reference?: string;
  note?: string;
  user?: string;
}) {
  if (params.qtyChange === 0) return;
  await InventoryMovement.create({
    productId: params.productId ?? null,
    productName: params.productName,
    type: params.type,
    qtyBefore: params.qtyBefore,
    qtyChange: params.qtyChange,
    qtyAfter: params.qtyAfter,
    reference: params.reference ?? "",
    note: params.note ?? "",
    user: params.user ?? currentUser(),
  });
}

// Apply a stock delta to a product AND record the movement. Stock never goes
// below zero. Returns the before/after quantities.
export async function applyStock(
  product: ProductDocument,
  change: number,
  type: MovementType,
  opts: MovementOpts = {}
) {
  const before = product.stockQty ?? 0;
  const after = Math.max(0, before + change);
  const realChange = after - before;

  product.stockQty = after;
  product.inStock = after > 0;
  if (opts.bumpRestocked && realChange > 0) product.lastRestockedAt = new Date();
  if (opts.bumpSold && realChange < 0) {
    product.soldCount = (product.soldCount ?? 0) + Math.abs(realChange);
    product.lastSoldAt = new Date();
  }
  if (opts.bumpSold && realChange > 0) {
    // Reversing a sale (return/cancel) — decrement soldCount.
    product.soldCount = Math.max(0, (product.soldCount ?? 0) - realChange);
  }
  await product.save();

  await logMovement({
    productId: product._id,
    productName: product.name,
    type,
    qtyBefore: before,
    qtyChange: realChange,
    qtyAfter: after,
    reference: opts.reference,
    note: opts.note,
    user: opts.user,
  });

  return { before, after, change: realChange };
}
