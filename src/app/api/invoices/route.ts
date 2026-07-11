import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice, INVOICE_STATUSES } from "@/models/Invoice";
import { nextNumber } from "@/lib/numbering";
import { shapeDocumentPayload, enrichItemsWithProfit } from "@/lib/documents";
import { applyInvoicePaid } from "@/lib/invoiceSale";
import { isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const status = req.nextUrl.searchParams.get("status");
    const limit = Math.min(5000, Number(req.nextUrl.searchParams.get("limit")) || 500);
    const filter = status ? { status } : {};
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .batchSize(limit)
      .lean();
    return NextResponse.json(invoices);
  } catch (err) {
    console.error("GET /api/invoices failed:", err);
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    const shaped = shapeDocumentPayload(body);
    if (!shaped.customerName) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }
    if (shaped.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }
    const status = INVOICE_STATUSES.includes(body.status) ? body.status : "draft";
    const enriched = await enrichItemsWithProfit(shaped.items, shaped.discount);

    const invoice = await Invoice.create({
      ...shaped,
      items: enriched.items,
      totalCost: enriched.totalCost,
      profit: enriched.profit,
      number: await nextNumber(Invoice, "INV"),
      status,
      dueDate: body.dueDate ?? "",
    });
    // An invoice created directly as paid records the sale + stock movement.
    if (invoice.status === "paid") await applyInvoicePaid(invoice);
    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    console.error("POST /api/invoices failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
