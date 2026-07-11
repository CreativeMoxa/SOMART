import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product, salePrice } from "@/models/Product";
import { Sale, PAYMENT_METHODS } from "@/models/Sale";
import { MARKETING_SOURCES, type MarketingSource } from "@/lib/marketing";
import { CUSTOMER_TYPES, type CustomerType } from "@/lib/customerType";
import { Customer } from "@/models/Customer";
import { nextNumber } from "@/lib/numbering";
import { computeProfit, round2 } from "@/lib/profit";
import { applyStock } from "@/lib/inventory";
import { isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const limit = Math.min(5000, Number(req.nextUrl.searchParams.get("limit")) || 100);
    const sales = await Sale.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .batchSize(limit)
      .lean();
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
      const price = salePrice(product);
      const costPrice = product.costPrice ?? 0;
      const { profitAmount, markupPercent, marginPercent } = computeProfit(price, costPrice);
      items.push({
        productId: product._id,
        name: product.name,
        price,
        costPrice,
        profitAmount,
        markupPercent,
        marginPercent,
        category: product.category ?? "",
        brand: product.brand ?? "",
        qty: quantity,
      });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const discount = Math.max(0, Number(body.discount) || 0);
    const total = Math.max(0, subtotal - discount);
    const totalCost = round2(items.reduce((sum, i) => sum + i.costPrice * i.qty, 0));
    const profit = round2(
      items.reduce((sum, i) => sum + (i.price - i.costPrice) * i.qty, 0) - discount
    );

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
      totalCost,
      profit,
      paymentMethod: body.paymentMethod ?? "cash",
      source: MARKETING_SOURCES.includes(body.source as MarketingSource)
        ? body.source
        : "walk-in",
      customerType: CUSTOMER_TYPES.includes(body.customerType as CustomerType)
        ? body.customerType
        : "retail",
      note: body.note ?? "",
    });

    // Decrement stock, bump sold counts, and log inventory movements.
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product) {
        await applyStock(product, -item.qty, "invoice-sale", {
          reference: sale.number,
          bumpSold: true,
          note: item.name,
        });
      }
    }

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    console.error("POST /api/sales failed:", err);
    const message = err instanceof Error ? err.message : "Failed to record sale";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
