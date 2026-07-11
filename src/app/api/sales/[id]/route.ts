import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { detachSaleFromInvoice } from "@/lib/invoiceSale";
import { applyStock } from "@/lib/inventory";
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

    // Pending sales never deducted stock, so only completed sales restore it.
    if (sale.status !== "pending") {
      for (const item of sale.items) {
        if (!item.productId) continue;
        const product = await Product.findById(item.productId);
        if (product) {
          await applyStock(product, item.qty, "invoice-returned", {
            reference: sale.number,
            bumpSold: true,
            note: item.name,
          });
        }
      }
    }

    // If this sale paid an invoice, mark that invoice unpaid again.
    await detachSaleFromInvoice(sale.invoiceId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sales/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
