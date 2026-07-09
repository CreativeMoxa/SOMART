import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice, INVOICE_STATUSES } from "@/models/Invoice";
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
      Object.assign(update, shaped, { dueDate: body.dueDate ?? "" });
    } else if (body.dueDate !== undefined) {
      update.dueDate = body.dueDate;
    }

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json(invoice);
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
    const invoice = await Invoice.findByIdAndDelete(id).lean();
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/invoices/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}
