import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Task, type TaskDoc } from "@/models/Task";
import { getCurrentUser } from "@/lib/auth";
import { isManagerRole } from "@/lib/roles";
import { nextNumber } from "@/lib/numbering";
import { recordAction } from "@/lib/audit";
import { TASK_STATUS_LABELS, itemPastDue, type TaskStatus, type Recurrence } from "@/lib/taskManager";
import { notifyTaskAssignees } from "@/lib/taskNotify";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Shift a YYYY-MM-DD date forward by one recurrence interval.
function shiftDate(date: string, recurrence: Recurrence, every: number): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  else if (recurrence === "custom") d.setDate(d.getDate() + Math.max(1, every || 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const { id } = await params;
    const task = await Task.findById(id).lean();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (!isManagerRole(user.role) && !(task.assigneeIds ?? []).includes(user.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(task);
  } catch (err) {
    console.error("GET /api/tasks/[id] failed:", err);
    return NextResponse.json({ error: "Failed to load task" }, { status: 500 });
  }
}

const MANAGER_FIELDS = [
  "title", "description", "category", "department", "priority", "status",
  "assignees", "assigneeIds", "startDate", "dueDate", "estimatedDate",
  "progress", "subtasks", "attachments", "internalNotes", "recurrence",
  "recurEvery", "isTemplate", "archived",
] as const;
// What an assigned employee is allowed to change on their own task.
const EMPLOYEE_FIELDS = ["status", "progress", "subtasks", "attachments"] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { id } = await params;
    const task = await Task.findById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const manager = isManagerRole(user.role);
    const mine = (task.assigneeIds ?? []).includes(user.id);
    if (!manager && !mine) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();

    // Deadline lock: an employee cannot touch a checklist item once its own due
    // date has passed — only a manager/CEO may. Past-due items coming from an
    // employee are reverted to their stored values.
    if (!manager && Array.isArray(body.subtasks)) {
      const existing = task.subtasks;
      body.subtasks = body.subtasks.map((incoming: unknown, i: number) => {
        const old = existing[i];
        if (old && itemPastDue(old.dueDate)) {
          return {
            title: old.title, priority: old.priority, dueDate: old.dueDate,
            target: old.target, doneCount: old.doneCount, status: old.status, done: old.done,
          };
        }
        return incoming;
      });
    }

    const allowed = manager ? MANAGER_FIELDS : EMPLOYEE_FIELDS;
    const prevStatus = task.status;
    const prevAssignees = (task.assignees ?? []).join(", ");
    const prevAssigneeIds = [...(task.assigneeIds ?? [])];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (task as any)[key] = body[key];
      }
    }

    // A new comment can be added by managers or the assigned employee.
    if (typeof body.addComment === "string" && body.addComment.trim()) {
      task.comments.push({ author: user.name, text: body.addComment.trim(), at: new Date() });
      task.activity.push({ actor: user.name, action: "added a comment", at: new Date() });
    }

    // Completion side-effects.
    if (task.status === "completed" && prevStatus !== "completed") {
      task.completedDate = todayKey();
      task.progress = 100;
    }
    if (task.status !== "completed") task.completedDate = task.completedDate && prevStatus === "completed" ? "" : task.completedDate;

    // Activity trail for meaningful manager changes.
    if (task.status !== prevStatus) {
      task.activity.push({
        actor: user.name,
        action: `moved to ${TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status}`,
        at: new Date(),
      });
    }
    if (manager && (task.assignees ?? []).join(", ") !== prevAssignees) {
      task.activity.push({
        actor: user.name,
        action: `reassigned to ${(task.assignees ?? []).join(", ") || "nobody"}`,
        at: new Date(),
      });
    }

    task.updatedBy = user.name;
    await task.save();

    // Email any newly-assigned employees.
    if (manager) {
      const added = (task.assigneeIds ?? []).filter((id) => !prevAssigneeIds.includes(id));
      if (added.length) {
        await notifyTaskAssignees(
          added,
          { number: task.number, title: task.title, priority: task.priority, dueDate: task.dueDate, description: task.description },
          user.name
        );
      }
    }

    // Spawn the next occurrence of a recurring task when it completes.
    let spawned: TaskDoc | null = null;
    if (
      task.status === "completed" &&
      prevStatus !== "completed" &&
      task.recurrence &&
      task.recurrence !== "none" &&
      !task.isTemplate
    ) {
      const created = await Task.create({
        number: await nextNumber(Task, "TSK"),
        title: task.title,
        description: task.description,
        category: task.category,
        department: task.department,
        priority: task.priority,
        assignees: task.assignees,
        assigneeIds: task.assigneeIds,
        startDate: shiftDate(task.startDate, task.recurrence as Recurrence, task.recurEvery),
        dueDate: shiftDate(task.dueDate, task.recurrence as Recurrence, task.recurEvery),
        estimatedDate: shiftDate(task.estimatedDate, task.recurrence as Recurrence, task.recurEvery),
        subtasks: (task.subtasks ?? []).map((s) => ({ title: s.title, done: false })),
        recurrence: task.recurrence,
        recurEvery: task.recurEvery,
        createdBy: user.name,
        updatedBy: user.name,
        activity: [{ actor: user.name, action: `auto-created from recurring ${task.number}`, at: new Date() }],
      });
      spawned = created.toObject();
    }

    await recordAction(`updated task ${task.number} — ${task.title}`, "tasks", task.number);
    return NextResponse.json({ task: task.toObject(), spawned });
  } catch (err) {
    console.error("PATCH /api/tasks/[id] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update task";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers can delete tasks" }, { status: 403 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const task = await Task.findById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const number = task.number;
    await task.deleteOne();
    await recordAction(`deleted task ${number}`, "tasks", number);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tasks/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
