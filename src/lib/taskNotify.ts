import { Employee } from "@/models/Employee";
import { sendTaskAssignedEmail } from "@/lib/email";

// Email the given employees that a task has been assigned to them. Best-effort:
// never throws, so it can't break task creation/updates. Only real employee
// ObjectIds are looked up (ad-hoc/legacy ids are ignored).
export async function notifyTaskAssignees(
  assigneeIds: string[],
  task: { number: string; title: string; priority?: string; dueDate?: string; description?: string },
  assignedBy?: string
): Promise<void> {
  try {
    const valid = (assigneeIds ?? []).filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
    if (valid.length === 0) return;
    const employees = await Employee.find({ _id: { $in: valid } })
      .select("name email")
      .lean();
    await Promise.all(
      employees
        .filter((e) => e.email)
        .map((e) =>
          sendTaskAssignedEmail(e.email, e.name, {
            number: task.number,
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
            description: task.description,
            assignedBy,
          })
        )
    );
  } catch (err) {
    console.error("[taskNotify] failed:", err);
  }
}
