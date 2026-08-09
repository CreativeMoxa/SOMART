// Business To-Do List — client-safe enums, labels, colours and progress helpers
// shared by the Todo model, the API and the UI. No mongoose imports here.

// What a to-do list is about — so the team can tell a stock order from a
// marketing push at a glance.
export const TODO_TYPES = [
  "general",
  "sales",
  "marketing",
  "freight",
  "inventory",
  "finance",
  "operations",
  "customers",
] as const;
export type TodoType = (typeof TODO_TYPES)[number];

export const TODO_TYPE_LABELS: Record<TodoType, string> = {
  general: "General",
  sales: "Sales",
  marketing: "Marketing",
  freight: "Freight / Stock Order",
  inventory: "Inventory",
  finance: "Finance",
  operations: "Operations",
  customers: "Customers",
};

export const TODO_TYPE_BADGE: Record<TodoType, string> = {
  general: "bg-slate-500/15 text-slate-400",
  sales: "bg-emerald-500/15 text-emerald-500",
  marketing: "bg-fuchsia-500/15 text-fuchsia-400",
  freight: "bg-violet-500/15 text-violet-400",
  inventory: "bg-teal-500/15 text-teal-400",
  finance: "bg-rose-500/15 text-rose-400",
  operations: "bg-sky-500/15 text-sky-400",
  customers: "bg-pink-500/15 text-pink-400",
};

// Each item is quantity-based: `target` units are needed (e.g. "40 orders") and
// `doneCount` is how many are finished. A plain checkbox item is just target 1.
export type TodoItem = { title?: string; target?: number; doneCount?: number; done?: boolean };

export function itemUnits(it: TodoItem): { done: number; target: number } {
  const target = Math.max(1, Math.round(it.target ?? 1));
  let done: number;
  if (it.doneCount != null) done = Math.max(0, Math.min(target, Math.round(it.doneCount)));
  else done = it.done ? target : 0;
  return { done, target };
}

// Completion across every item: done units / total units.
export function todoProgress(items: TodoItem[]): { done: number; total: number; percent: number } {
  let done = 0;
  let total = 0;
  for (const it of items ?? []) {
    const u = itemUnits(it);
    done += u.done;
    total += u.target;
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function isPastDue(dueDate?: string): boolean {
  if (!dueDate) return false;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return dueDate < today;
}

export type TodoStatus = "open" | "done" | "overdue";

// Status is automatic: Done when every unit is finished, Overdue when past the
// deadline with work left, otherwise Open.
export function todoStatus(todo: { items?: TodoItem[]; dueDate?: string }): TodoStatus {
  const { done, total } = todoProgress(todo.items ?? []);
  if (total > 0 && done >= total) return "done";
  if (isPastDue(todo.dueDate)) return "overdue";
  return "open";
}

export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  open: "Open",
  done: "Done",
  overdue: "Overdue",
};
export const TODO_STATUS_BADGE: Record<TodoStatus, string> = {
  open: "bg-sky-500/15 text-sky-400",
  done: "bg-emerald-500/15 text-emerald-500",
  overdue: "bg-red-500/20 text-red-500",
};
