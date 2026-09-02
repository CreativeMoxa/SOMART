import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Obligation } from "@/models/Obligation";
import { isUnlocked } from "@/lib/businessBalance";
import { actorName } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const ob = await Obligation.findById(id);
    if (!ob) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (body.status === "paid" || body.status === "unpaid") ob.status = body.status;
    if (body.description !== undefined) ob.description = String(body.description).trim();
    if (body.amount !== undefined) ob.amount = Math.max(0, Number(body.amount) || 0);
    if (body.date !== undefined) ob.date = String(body.date).trim();
    if (body.reason !== undefined) ob.reason = String(body.reason).trim();
    ob.updatedBy = await actorName();
    await ob.save();
    return NextResponse.json(ob.toObject());
  } catch (err) {
    console.error("PATCH /api/accounting/obligations/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update obligation" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  try {
    await connectDB();
    const { id } = await params;
    await Obligation.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/accounting/obligations/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete obligation" }, { status: 500 });
  }
}
