import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { getCurrentUser } from "@/lib/auth";
import { isManagerRole } from "@/lib/roles";
import { nextNumber } from "@/lib/numbering";
import { recordAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/tasks?scope=active|archived|templates
// Managers see every task; other roles see only tasks assigned to them.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const scope = req.nextUrl.searchParams.get("scope") || "active";
    const filter: Record<string, unknown> = {};

    if (scope === "templates") filter.isTemplate = true;
    else if (scope === "archived") {
      filter.isTemplate = false;
      filter.archived = true;
    } else {
      filter.isTemplate = false;
      filter.archived = false;
    }

    // Employees only ever see their own assigned tasks.
    if (!isManagerRole(user.role)) {
      filter.assigneeIds = user.id;
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json(tasks);
  } catch (err) {
    console.error("GET /api/tasks failed:", err);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}

// POST /api/tasks — create a task (managers only). Pass fromTemplateId to
// seed the new task from a saved template.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers can create tasks" }, { status: 403 });
  }

  try {
    await connectDB();
    const body = await req.json();

    let seed: Record<string, unknown> = {};
    if (body.fromTemplateId) {
      const tpl = await Task.findById(body.fromTemplateId).lean();
      if (tpl) {
        seed = {
          title: tpl.title,
          description: tpl.description,
          category: tpl.category,
          department: tpl.department,
          priority: tpl.priority,
          subtasks: (tpl.subtasks ?? []).map((s) => ({ title: s.title, done: false })),
          recurrence: tpl.recurrence,
          recurEvery: tpl.recurEvery,
        };
      }
    }

    const assignees: string[] = Array.isArray(body.assignees) ? body.assignees : [];
    const assigneeIds: string[] = Array.isArray(body.assigneeIds) ? body.assigneeIds : [];

    const task = await Task.create({
      ...seed,
      ...body,
      assignees,
      assigneeIds,
      number: await nextNumber(Task, "TSK"),
      createdBy: user.name,
      updatedBy: user.name,
      activity: [
        { actor: user.name, action: "created the task", at: new Date() },
        ...(assignees.length
          ? [{ actor: user.name, action: `assigned to ${assignees.join(", ")}`, at: new Date() }]
          : []),
      ],
    });

    await recordAction(`created task ${task.number} — ${task.title}`, "tasks", task.number);
    return NextResponse.json(task.toObject(), { status: 201 });
  } catch (err) {
    console.error("POST /api/tasks failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
