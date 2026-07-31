import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { getCurrentUser } from "@/lib/auth";
import { isManagerRole } from "@/lib/roles";
import { nextNumber } from "@/lib/numbering";
import { recordAction } from "@/lib/audit";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

// POST /api/tasks/[id]/duplicate — manager-only clone of a task (fresh id,
// reset progress/status/history), handy for repeating similar work.
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers can duplicate tasks" }, { status: 403 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const src = await Task.findById(id).lean();
    if (!src) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const copy = await Task.create({
      number: await nextNumber(Task, "TSK"),
      title: `${src.title} (copy)`,
      description: src.description,
      category: src.category,
      department: src.department,
      priority: src.priority,
      status: "draft",
      assignees: src.assignees,
      assigneeIds: src.assigneeIds,
      startDate: src.startDate,
      dueDate: src.dueDate,
      estimatedDate: src.estimatedDate,
      progress: 0,
      subtasks: (src.subtasks ?? []).map((s) => ({ title: s.title, done: false })),
      internalNotes: src.internalNotes,
      recurrence: src.recurrence,
      recurEvery: src.recurEvery,
      isTemplate: src.isTemplate,
      createdBy: user.name,
      updatedBy: user.name,
      activity: [{ actor: user.name, action: `duplicated from ${src.number}`, at: new Date() }],
    });

    await recordAction(`duplicated task ${src.number} → ${copy.number}`, "tasks", copy.number);
    return NextResponse.json(copy.toObject(), { status: 201 });
  } catch (err) {
    console.error("POST /api/tasks/[id]/duplicate failed:", err);
    return NextResponse.json({ error: "Failed to duplicate task" }, { status: 500 });
  }
}
