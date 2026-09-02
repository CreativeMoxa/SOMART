import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Obligation } from "@/models/Obligation";
import { isUnlocked } from "@/lib/businessBalance";
import { actorName } from "@/lib/audit";

export async function POST(req: NextRequest) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  try {
    await connectDB();
    const body = await req.json();
    const description = String(body.description ?? "").trim();
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
    const who = await actorName();
    const ob = await Obligation.create({
      description,
      amount: Math.max(0, Number(body.amount) || 0),
      date: String(body.date ?? "").trim(),
      reason: String(body.reason ?? "").trim(),
      status: body.status === "paid" ? "paid" : "unpaid",
      createdBy: who,
      updatedBy: who,
    });
    return NextResponse.json(ob.toObject(), { status: 201 });
  } catch (err) {
    console.error("POST /api/accounting/obligations failed:", err);
    return NextResponse.json({ error: "Failed to save obligation" }, { status: 400 });
  }
}
