import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Expense, EXPENSE_CATEGORIES } from "@/models/Expense";
import { isAdmin } from "@/lib/auth";

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
    if (!body.title || body.amount === undefined || !body.date) {
      return NextResponse.json(
        { error: "Title, amount and date are required" },
        { status: 400 }
      );
    }
    if (body.category && !EXPENSE_CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    }
    const expense = await Expense.create(body);
    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    console.error("POST /api/expenses failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create expense";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
