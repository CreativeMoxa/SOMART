import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice, INVOICE_STATUSES } from "@/models/Invoice";
import { Sale } from "@/models/Sale";
import { nextNumber } from "@/lib/numbering";
import { shapeDocumentPayload, enrichItemsWithProfit } from "@/lib/documents";
import { applyInvoicePaid } from "@/lib/invoiceSale";
import { deriveInvoiceStatus } from "@/lib/invoiceStatus";
import { isAdmin } from "@/lib/auth";
import { stampAudit, recordAction } from "@/lib/audit";

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

    // Attach the connected sale's number (for the "Payment Communication" line
    // on the PDF) in a single extra lookup rather than per-row populate.
    const saleIds = invoices
      .map((inv) => inv.saleId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));
    if (saleIds.length) {
      const sales = await Sale.find({ _id: { $in: saleIds } })
        .select("_id number")
        .lean();
      const numberById = new Map(sales.map((s) => [String(s._id), s.number]));
      for (const inv of invoices) {
        (inv as { saleNumber?: string | null }).saleNumber = inv.saleId
          ? numberById.get(String(inv.saleId)) ?? null
          : null;
      }
    }
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
    const chosen = INVOICE_STATUSES.includes(body.status) ? body.status : "draft";
    const enriched = await enrichItemsWithProfit(shaped.items, shaped.discount);
    // Only "partial" carries an amount paid; other statuses stand on their own
    // (a paid invoice is fully paid, everything else owes the full total).
    const pay =
      body.amountPaid !== undefined
        ? deriveInvoiceStatus(chosen, Number(body.amountPaid), shaped.total)
        : chosen === "paid"
          ? { status: "paid", amountPaid: shaped.total, balance: 0 }
          : { status: chosen, amountPaid: 0, balance: shaped.total };

    const invoice = await Invoice.create({
      ...shaped,
      items: enriched.items,
      totalCost: enriched.totalCost,
      profit: enriched.profit,
      number: await nextNumber(Invoice, "INV"),
      status: pay.status,
      amountPaid: pay.amountPaid,
      dueDate: body.dueDate ?? "",
      ...(await stampAudit({}, "create")),
    });
    // An invoice created directly as paid records the sale + stock movement.
    if (invoice.status === "paid") await applyInvoicePaid(invoice);
    await recordAction(`created Invoice ${invoice.number}`, "invoices", invoice.number);
    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    console.error("POST /api/invoices failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
