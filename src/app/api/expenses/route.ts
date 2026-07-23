import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Expense, EXPENSE_CATEGORIES } from "@/models/Expense";
import { isAdmin } from "@/lib/auth";
import { stampAudit, recordAction } from "@/lib/audit";

// Server-authoritative recording date (local calendar day). Employees never set
// this — it's the day the expense is entered, so financial data stays reliable.
function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const expenses = await Expense.find().sort({ date: -1 }).lean();
    return NextResponse.json(expenses);
  } catch (err) {
    console.error("GET /api/expenses failed:", err);
    return NextResponse.json({ error: "Failed to load expenses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    if (!body.title || body.amount === undefined) {
      return NextResponse.json(
        { error: "Title and amount are required" },
        { status: 400 }
      );
    }
    if (body.category && !EXPENSE_CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    }
    // Build the record explicitly so the client can't set date/createdAt — the
    // recording date is fixed to today by the server and can't be back-dated.
    const expense = await Expense.create({
      title: String(body.title).trim(),
      category: body.category ?? "other",
      amount: Math.max(0, Number(body.amount) || 0),
      notes: String(body.notes ?? ""),
      date: todayStamp(),
      ...(await stampAudit({}, "create")),
    });
    await recordAction(`recorded Expense ${expense.title}`, "accounting", expense.title);
    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    console.error("POST /api/expenses failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create expense";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
