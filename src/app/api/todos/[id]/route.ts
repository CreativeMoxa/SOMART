import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Todo } from "@/models/Todo";
import { isAdmin } from "@/lib/auth";
import { TODO_TYPES } from "@/lib/todoList";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

const FIELDS = ["title", "type", "notes", "dueDate", "items", "archived"] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const todo = await Todo.findById(id);
    if (!todo) return NextResponse.json({ error: "To-do list not found" }, { status: 404 });

    const body = await req.json();
    for (const key of FIELDS) {
      if (body[key] !== undefined) {
        if (key === "type" && !TODO_TYPES.includes(body.type)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (todo as any)[key] = body[key];
      }
    }
    await todo.save();
    return NextResponse.json(todo.toObject());
  } catch (err) {
    console.error("PATCH /api/todos/[id] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update to-do list";
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
    const todo = await Todo.findByIdAndDelete(id);
    if (!todo) return NextResponse.json({ error: "To-do list not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/todos/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete to-do list" }, { status: 500 });
  }
}
