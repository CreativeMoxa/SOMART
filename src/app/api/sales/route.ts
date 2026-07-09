import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product, salePrice } from "@/models/Product";
import { Sale, PAYMENT_METHODS } from "@/models/Sale";
import { Customer } from "@/models/Customer";
import { nextNumber } from "@/lib/numbering";
import { isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);
    const sales = await Sale.find().sort({ createdAt: -1 }).limit(limit).lean();
    return NextResponse.json(sales);
  } catch (err) {
    console.error("GET /api/sales failed:", err);
    return NextResponse.json({ error: "Failed to load sales" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    const requestedItems: { productId: string; qty: number }[] = body.items ?? [];
    if (requestedItems.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }
    if (body.paymentMethod && !PAYMENT_METHODS.includes(body.paymentMethod)) {
      return NextResponse.json({ error: "Unknown payment method" }, { status: 400 });
    }

    const items = [];
    for (const { productId, qty } of requestedItems) {
      const quantity = Math.max(1, Math.floor(Number(qty) || 1));
      const product = await Product.findById(productId);
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 400 });
      }
      if (product.stockQty < quantity) {
        return NextResponse.json(
          { error: `Not enough stock for "${product.name}" (${product.stockQty} left)` },
          { status: 400 }
        );
      }
      items.push({
        productId: product._id,
        name: product.name,
        price: salePrice(product),
        costPrice: product.costPrice ?? 0,
        qty: quantity,
      });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const discount = Math.max(0, Number(body.discount) || 0);
    const total = Math.max(0, subtotal - discount);
    const profit =
      items.reduce((sum, i) => sum + (i.price - i.costPrice) * i.qty, 0) - discount;

    let customerName = "Walk-in";
    if (body.customerId) {
      const customer = await Customer.findById(body.customerId).lean();
      if (customer) customerName = customer.name;
    }

    const sale = await Sale.create({
      number: await nextNumber(Sale, "SAL"),
      items,
      customerId: body.customerId || null,
      customerName,
      subtotal,
      discount,
      total,
      profit,
      paymentMethod: body.paymentMethod ?? "cash",
      note: body.note ?? "",
    });

    // Decrement stock and bump sold counts after the sale is recorded.
    for (const item of items) {
      const updated = await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stockQty: -item.qty, soldCount: item.qty } },
        { new: true }
      );
      if (updated && updated.stockQty <= 0 && updated.inStock) {
        updated.inStock = false;
        await updated.save();
      }
    }

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    console.error("POST /api/sales failed:", err);
    const message = err instanceof Error ? err.message : "Failed to record sale";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
