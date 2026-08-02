import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { Employee } from "@/models/Employee";
import { getCurrentUser } from "@/lib/auth";
import { isManagerRole } from "@/lib/roles";
import { taskCompletion } from "@/lib/taskManager";
import { sendTaskReminderEmail } from "@/lib/email";
import { recordAction } from "@/lib/audit";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

// POST /api/tasks/[id]/remind — manager emails the assigned employee(s) a
// branded reminder with their current completion percentage.
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers can send reminders" }, { status: 403 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const task = await Task.findById(id).lean();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const comp = taskCompletion(task);
    const valid = (task.assigneeIds ?? []).filter((x) => /^[0-9a-fA-F]{24}$/.test(x));
    if (valid.length === 0) {
      return NextResponse.json({ error: "This task has no assigned employee to remind." }, { status: 400 });
    }
    const employees = await Employee.find({ _id: { $in: valid } }).select("name email").lean();
    const targets = employees.filter((e) => e.email);
    if (targets.length === 0) {
      return NextResponse.json({ error: "No email on file for the assigned employee." }, { status: 400 });
    }

    const results = await Promise.all(
      targets.map((e) =>
        sendTaskReminderEmail(e.email, e.name, {
          number: task.number,
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
          remindedBy: user.name,
          done: comp.done,
          total: comp.total,
          percent: comp.percent,
        })
      )
    );
    const sent = results.filter(Boolean).length;
    await recordAction(`sent a reminder for task ${task.number}`, "tasks", task.number);

    return NextResponse.json({
      ok: true,
      sent,
      recipients: targets.map((e) => e.name),
      // If SMTP isn't configured nothing actually leaves the server.
      delivered: sent > 0,
    });
  } catch (err) {
    console.error("POST /api/tasks/[id]/remind failed:", err);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
