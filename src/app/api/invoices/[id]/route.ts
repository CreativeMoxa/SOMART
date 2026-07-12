import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice, INVOICE_STATUSES } from "@/models/Invoice";
import { shapeDocumentPayload, enrichItemsWithProfit } from "@/lib/documents";
import { applyInvoicePaid, revertInvoicePaid, removeInvoiceSale } from "@/lib/invoiceSale";
import { isAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (err) {
    console.error("GET /api/invoices/[id] failed:", err);
    return NextResponse.json({ error: "Failed to load invoice" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    // Status-only quick update (e.g. mark paid).
    const update: Record<string, unknown> = {};
    if (body.status) {
      if (!INVOICE_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Unknown status" }, { status: 400 });
      }
      update.status = body.status;
    }
    if (body.items) {
      const shaped = shapeDocumentPayload(body);
      if (!shaped.customerName) {
        return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
      }
      const enriched = await enrichItemsWithProfit(shaped.items, shaped.discount);
      Object.assign(update, shaped, {
        items: enriched.items,
        totalCost: enriched.totalCost,
        profit: enriched.profit,
        dueDate: body.dueDate ?? "",
      });
    } else {
      if (body.dueDate !== undefined) update.dueDate = body.dueDate;
      if (body.customerType !== undefined) update.customerType = body.customerType;
      if (body.source !== undefined) update.source = body.source;
      if (body.paymentMethod !== undefined) update.paymentMethod = body.paymentMethod;
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    const wasPaid = invoice.status === "paid";

    invoice.set(update);
    await invoice.save();

    // Paid ⇄ unpaid transitions move inventory and the linked sale record.
    if (!wasPaid && invoice.status === "paid") await applyInvoicePaid(invoice);
    if (wasPaid && invoice.status !== "paid") await revertInvoicePaid(invoice);

    return NextResponse.json(invoice.toObject());
  } catch (err) {
    console.error("PATCH /api/invoices/[id] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const invoice = await Invoice.findById(id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    // Deleting a paid invoice restores stock and removes its linked sale.
    await removeInvoiceSale(invoice);
    await invoice.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/invoices/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}
