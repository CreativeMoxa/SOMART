// Task Manager — client-safe enums, labels and colours shared by the Task
// model, the API and the UI. No mongoose imports here.

export const TASK_STATUSES = [
  "draft",
  "not-started",
  "in-progress",
  "waiting-review",
  "on-hold",
  "completed",
  "cancelled",
  "overdue",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "Draft",
  "not-started": "Not Started",
  "in-progress": "In Progress",
  "waiting-review": "Waiting for Review",
  "on-hold": "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

// Tailwind badge classes per status (work in light + dark).
export const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  draft: "bg-slate-500/15 text-slate-400",
  "not-started": "bg-slate-500/15 text-slate-400",
  "in-progress": "bg-sky-500/15 text-sky-400",
  "waiting-review": "bg-violet-500/15 text-violet-400",
  "on-hold": "bg-amber-500/15 text-amber-500",
  completed: "bg-emerald-500/15 text-emerald-500",
  cancelled: "bg-rose-500/15 text-rose-400",
  overdue: "bg-red-500/20 text-red-500",
};

// Statuses shown as columns on the Kanban board (cancelled/draft are hidden
// there but still selectable elsewhere).
export const KANBAN_STATUSES: TaskStatus[] = [
  "not-started",
  "in-progress",
  "waiting-review",
  "on-hold",
  "completed",
];

export const OPEN_STATUSES: TaskStatus[] = [
  "draft",
  "not-started",
  "in-progress",
  "waiting-review",
  "on-hold",
  "overdue",
];

// Each checklist item carries its own status (like an invoice's paid/unpaid),
// not a plain checkbox. Completion is measured from these.
export const CHECKLIST_STATUSES = [
  "not-started",
  "in-progress",
  "on-hold",
  "completed",
  "cancelled",
] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];
export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  "on-hold": "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const CHECKLIST_STATUS_BADGE: Record<ChecklistStatus, string> = {
  "not-started": "bg-slate-500/15 text-slate-400",
  "in-progress": "bg-sky-500/15 text-sky-400",
  "on-hold": "bg-amber-500/15 text-amber-500",
  completed: "bg-emerald-500/15 text-emerald-500",
  cancelled: "bg-rose-500/15 text-rose-400",
};

// Effective status of a checklist item (tolerates legacy items that only had a
// `done` boolean before statuses existed).
export function checklistStatus(item: { status?: string; done?: boolean }): ChecklistStatus {
  if (item.status && (CHECKLIST_STATUSES as readonly string[]).includes(item.status)) {
    return item.status as ChecklistStatus;
  }
  return item.done ? "completed" : "not-started";
}

// A checklist item is past its own deadline (used to lock it for employees —
// after the due date only a manager/CEO may change its status).
export function itemPastDue(dueDate?: string): boolean {
  if (!dueDate) return false;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return dueDate < today;
}

// Each checklist item is quantity-based: `target` units are needed (e.g. "post
// 3 videos") and `doneCount` is how many are finished. Legacy items that only
// had a status/done flag are treated as a single unit.
type ChecklistItem = { target?: number; doneCount?: number; status?: string; done?: boolean };
export function itemUnits(item: ChecklistItem): { done: number; target: number } {
  const target = Math.max(1, Math.round(item.target ?? 1));
  let done: number;
  if (item.doneCount != null) done = Math.max(0, Math.min(target, Math.round(item.doneCount)));
  else done = checklistStatus(item) === "completed" ? target : 0; // legacy
  return { done, target };
}

// Status is automatic from progress: none done → Not Started, some → In
// Progress, all → Completed.
export function deriveItemStatus(done: number, target: number): ChecklistStatus {
  if (done <= 0) return "not-started";
  if (done >= target) return "completed";
  return "in-progress";
}

// Completion of one task = done units / total units across its checklist.
// A task with no checklist falls back to its own progress field.
export function taskCompletion(task: {
  subtasks?: ChecklistItem[];
  progress?: number;
}): { done: number; total: number; percent: number } {
  const items = task.subtasks ?? [];
  if (items.length === 0) {
    return { done: 0, total: 0, percent: task.progress ?? 0 };
  }
  let done = 0;
  let total = 0;
  for (const it of items) {
    const u = itemUnits(it);
    done += u.done;
    total += u.target;
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};
export const PRIORITY_BADGE: Record<Priority, string> = {
  low: "bg-slate-500/15 text-slate-400",
  medium: "bg-sky-500/15 text-sky-400",
  high: "bg-amber-500/15 text-amber-500",
  critical: "bg-red-500/20 text-red-500",
};
export const PRIORITY_RANK: Record<Priority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const DEPARTMENTS = [
  "management",
  "sales",
  "marketing",
  "products",
  "inventory",
  "freight",
  "finance",
  "customers",
  "operations",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

// Suggested categories (stored as free text so managers can add their own).
export const TASK_CATEGORIES = [
  "General",
  "Sales",
  "Marketing",
  "Inventory",
  "Freight",
  "Finance",
  "Customer",
  "Admin",
  "Maintenance",
] as const;

export const RECURRENCES = ["none", "daily", "weekly", "monthly", "custom"] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom (every N days)",
};

export function labelize(value: string): string {
  return value
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// A task counts as overdue when it has a due date in the past and isn't in a
// terminal state. Kept here so the model, API and UI agree.
export function isOverdue(dueDate: string | undefined, status: string): boolean {
  if (!dueDate) return false;
  if (status === "completed" || status === "cancelled") return false;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dueDate < todayKey;
}
