import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { isAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const sale = await Sale.findById(id).lean();
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    return NextResponse.json(sale);
  } catch (err) {
    console.error("GET /api/sales/[id] failed:", err);
    return NextResponse.json({ error: "Failed to load sale" }, { status: 500 });
  }
}

// Deleting a sale acts as a return: stock is restored.
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const sale = await Sale.findByIdAndDelete(id).lean();
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    for (const item of sale.items) {
      if (!item.productId) continue;
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stockQty: item.qty, soldCount: -item.qty },
        $set: { inStock: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sales/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
