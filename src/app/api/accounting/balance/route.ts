import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BusinessBalance, getBusinessBalance, BALANCE_METHODS, type BalanceMethod } from "@/models/BusinessBalance";
import { Obligation } from "@/models/Obligation";
import { BalanceLog } from "@/models/BalanceLog";
import { isUnlocked } from "@/lib/businessBalance";
import { actorName } from "@/lib/audit";
import { round2 } from "@/lib/profit";

async function payload() {
  const [balance, obligations, logs] = await Promise.all([
    getBusinessBalance(),
    Obligation.find().sort({ status: 1, createdAt: -1 }).lean(),
    BalanceLog.find().sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  const total = round2(BALANCE_METHODS.reduce((s, m) => s + (balance[m] ?? 0), 0));
  const totalOwed = round2(
    obligations.filter((o) => o.status === "unpaid").reduce((s, o) => s + (o.amount ?? 0), 0)
  );
  return {
    balance: BALANCE_METHODS.reduce((acc, m) => ({ ...acc, [m]: balance[m] ?? 0 }), {} as Record<BalanceMethod, number>),
    total,
    obligations: JSON.parse(JSON.stringify(obligations)),
    totalOwed,
    netPosition: round2(total - totalOwed),
    logs: JSON.parse(JSON.stringify(logs)),
  };
}

export async function GET() {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  try {
    await connectDB();
    return NextResponse.json(await payload());
  } catch (err) {
    console.error("GET /api/accounting/balance failed:", err);
    return NextResponse.json({ error: "Failed to load balance" }, { status: 500 });
  }
}

// PATCH { amounts: { zaad, slcash, ... } } → set balances, audit each change.
export async function PATCH(req: NextRequest) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  try {
    await connectDB();
    const body = await req.json();
    const amounts = (body.amounts ?? {}) as Record<string, unknown>;
    const doc = await BusinessBalance.findOne({ key: "main" }) ?? (await BusinessBalance.create({ key: "main" }));
    const who = await actorName();
    const logs: Record<string, unknown>[] = [];
    for (const m of BALANCE_METHODS) {
      if (amounts[m] === undefined) continue;
      const prev = doc[m] ?? 0;
      const next = round2(Number(amounts[m]) || 0);
      if (next !== prev) {
        logs.push({ method: m, previousAmount: prev, newAmount: next, adjustment: round2(next - prev), by: who });
        doc[m] = next;
      }
    }
    doc.updatedBy = who;
    await doc.save();
    if (logs.length) await BalanceLog.insertMany(logs);
    return NextResponse.json(await payload());
  } catch (err) {
    console.error("PATCH /api/accounting/balance failed:", err);
    return NextResponse.json({ error: "Failed to update balance" }, { status: 400 });
  }
}
