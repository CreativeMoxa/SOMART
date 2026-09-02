import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AccountingEntry, ACCOUNTING_ENTRY_TYPES } from "@/models/AccountingEntry";
import { requireModule } from "@/lib/auth";
import { actorName, recordAction } from "@/lib/audit";
import { normalizePaymentMethod } from "@/lib/payment";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireModule("accounts"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const entry = await AccountingEntry.findById(id);
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    if (body.type !== undefined && ACCOUNTING_ENTRY_TYPES.includes(body.type)) entry.type = body.type;
    if (body.date !== undefined) entry.date = String(body.date).trim();
    if (body.description !== undefined) entry.description = String(body.description).trim();
    if (body.amount !== undefined) {
      const n = Number(body.amount) || 0;
      entry.amount = entry.type !== "adjustment" ? Math.abs(n) : n;
    }
    if (body.paymentMethod !== undefined) entry.paymentMethod = normalizePaymentMethod(body.paymentMethod);
    if (body.notes !== undefined) entry.notes = String(body.notes).trim();
    entry.updatedBy = await actorName();
    await entry.save();
    await recordAction(`edited ${entry.type} entry`, "accounts", entry.description);
    return NextResponse.json(entry.toObject());
  } catch (err) {
    console.error("PATCH /api/accounting/entries/[id] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update entry";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await requireModule("accounts"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const entry = await AccountingEntry.findById(id);
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    const desc = entry.description;
    await entry.deleteOne();
    await recordAction("deleted accounting entry", "accounts", desc);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/accounting/entries/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
