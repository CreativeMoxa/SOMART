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
