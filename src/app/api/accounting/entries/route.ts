import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AccountingEntry, ACCOUNTING_ENTRY_TYPES } from "@/models/AccountingEntry";
import { requireModule } from "@/lib/auth";
import { actorName, recordAction } from "@/lib/audit";
import { normalizePaymentMethod } from "@/lib/payment";

function shape(body: Record<string, unknown>) {
  const type = ACCOUNTING_ENTRY_TYPES.includes(body.type as never)
    ? (body.type as (typeof ACCOUNTING_ENTRY_TYPES)[number])
    : "income";
  let amount = Number(body.amount) || 0;
  // Income/expense are magnitudes; adjustments keep their sign.
  if (type !== "adjustment") amount = Math.abs(amount);
  return {
    date: String(body.date ?? "").trim() || new Date().toISOString().slice(0, 10),
    description: String(body.description ?? "").trim(),
    type,
    amount,
    paymentMethod: normalizePaymentMethod(body.paymentMethod),
    notes: String(body.notes ?? "").trim(),
  };
}

export async function GET(req: NextRequest) {
  if (!(await requireModule("accounts"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const start = req.nextUrl.searchParams.get("start");
    const end = req.nextUrl.searchParams.get("end");
    const q: Record<string, unknown> = {};
    if (start && end) q.date = { $gte: start, $lte: end };
    const entries = await AccountingEntry.find(q).sort({ date: -1, createdAt: -1 }).limit(2000).lean();
    return NextResponse.json(entries);
  } catch (err) {
    console.error("GET /api/accounting/entries failed:", err);
    return NextResponse.json({ error: "Failed to load entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireModule("accounts"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const shaped = shape(await req.json());
    if (!shaped.description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    const who = await actorName();
    const entry = await AccountingEntry.create({ ...shaped, createdBy: who, updatedBy: who });
    await recordAction(`added ${shaped.type} entry (${shaped.amount})`, "accounts", shaped.description);
    return NextResponse.json(entry.toObject(), { status: 201 });
  } catch (err) {
    console.error("POST /api/accounting/entries failed:", err);
    const message = err instanceof Error ? err.message : "Failed to save entry";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
