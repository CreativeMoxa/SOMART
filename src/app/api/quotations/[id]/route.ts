import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Quotation, QUOTATION_STATUSES } from "@/models/Quotation";
import { Invoice } from "@/models/Invoice";
import { nextNumber } from "@/lib/numbering";
import { shapeDocumentPayload } from "@/lib/documents";
import { isAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const quotation = await Quotation.findById(id).lean();
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    return NextResponse.json(quotation);
  } catch (err) {
    console.error("GET /api/quotations/[id] failed:", err);
    return NextResponse.json({ error: "Failed to load quotation" }, { status: 500 });
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

    // Convert an approved quotation into an unpaid invoice.
    if (body.action === "convert") {
      const quotation = await Quotation.findById(id);
      if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
      if (quotation.invoiceId) {
        return NextResponse.json({ error: "Already converted to an invoice" }, { status: 400 });
      }
      const invoice = await Invoice.create({
        number: await nextNumber(Invoice, "INV"),
        customerId: quotation.customerId,
        customerName: quotation.customerName,
        customerPhone: quotation.customerPhone,
        items: quotation.items,
        subtotal: quotation.subtotal,
        discount: quotation.discount,
        tax: quotation.tax,
        total: quotation.total,
        status: "unpaid",
        source: quotation.source ?? "walk-in",
        notes: quotation.notes,
      });
      quotation.invoiceId = invoice._id;
      quotation.status = "approved";
      await quotation.save();
      return NextResponse.json({ quotation, invoice });
    }

    const update: Record<string, unknown> = {};
    if (body.status) {
      if (!QUOTATION_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Unknown status" }, { status: 400 });
      }
      update.status = body.status;
    }
    if (body.items) {
      const shaped = shapeDocumentPayload(body);
      if (!shaped.customerName) {
        return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
      }
      Object.assign(update, shaped, { validUntil: body.validUntil ?? "" });
    } else if (body.validUntil !== undefined) {
      update.validUntil = body.validUntil;
    }

    const quotation = await Quotation.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    return NextResponse.json(quotation);
  } catch (err) {
    console.error("PATCH /api/quotations/[id] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update quotation";
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
    const quotation = await Quotation.findByIdAndDelete(id).lean();
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/quotations/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete quotation" }, { status: 500 });
  }
}
