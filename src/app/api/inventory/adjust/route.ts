import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { applyStock } from "@/lib/inventory";
import { INVENTORY_ACTIONS, type InventoryAction, type MovementType } from "@/lib/inventoryMovement";
import { isAdmin } from "@/lib/auth";

// Manual store-inventory actions: Receive Stock, Adjust Stock, Stock Count, Write Off.
const ACTION_MOVEMENT: Record<InventoryAction, MovementType> = {
  receive: "manual-receive",
  adjust: "manual-adjustment",
  count: "stock-count",
  "write-off": "write-off",
};

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    const action = body.action as InventoryAction;
    if (!INVENTORY_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    const product = await Product.findById(body.productId);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const before = product.stockQty ?? 0;
    let change = 0;
    if (action === "receive") change = Math.abs(Math.floor(Number(body.qty) || 0));
    else if (action === "write-off") change = -Math.abs(Math.floor(Number(body.qty) || 0));
    else if (action === "adjust") change = Math.floor(Number(body.qty) || 0);
    else if (action === "count") change = Math.max(0, Math.floor(Number(body.count) || 0)) - before;

    if (change === 0) {
      return NextResponse.json({ error: "No stock change" }, { status: 400 });
    }

    // minStock can be updated alongside a receive/adjust (optional).
    if (body.minStock !== undefined) {
      product.minStock = Math.max(0, Math.floor(Number(body.minStock) || 0));
    }

    const result = await applyStock(product, change, ACTION_MOVEMENT[action], {
      reference: String(body.reference ?? ""),
      note: String(body.note ?? ""),
      bumpRestocked: action === "receive",
    });

    return NextResponse.json({ ok: true, ...result, product: product.toObject() });
  } catch (err) {
    console.error("POST /api/inventory/adjust failed:", err);
    const message = err instanceof Error ? err.message : "Failed to adjust stock";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
