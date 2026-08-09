import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Todo } from "@/models/Todo";
import { isAdmin } from "@/lib/auth";
import { nextNumber } from "@/lib/numbering";
import { TODO_TYPES } from "@/lib/todoList";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const todos = await Todo.find({ archived: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    return NextResponse.json(todos);
  } catch (err) {
    console.error("GET /api/todos failed:", err);
    return NextResponse.json({ error: "Failed to load to-do lists" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const type = TODO_TYPES.includes(body.type) ? body.type : "general";
    const items = Array.isArray(body.items) ? body.items : [];
    const todo = await Todo.create({
      number: await nextNumber(Todo, "TODO"),
      title,
      type,
      notes: String(body.notes ?? ""),
      dueDate: String(body.dueDate ?? ""),
      items,
    });
    return NextResponse.json(todo, { status: 201 });
  } catch (err) {
    console.error("POST /api/todos failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create to-do list";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
