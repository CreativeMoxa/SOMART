"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_BADGE,
  KANBAN_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_BADGE,
  PRIORITY_RANK,
  DEPARTMENTS,
  TASK_CATEGORIES,
  RECURRENCES,
  RECURRENCE_LABELS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_BADGE,
  taskCompletion,
  itemUnits,
  deriveItemStatus,
  itemPastDue,
  isOverdue,
  labelize,
  type TaskStatus,
  type Priority,
  type ChecklistStatus,
} from "@/lib/taskManager";
import { ROLE_LABELS, type Role } from "@/lib/roles";

type Subtask = { _id?: string; title: string; priority?: Priority; dueDate?: string; target?: number; doneCount?: number; status: ChecklistStatus; done?: boolean };
type Comment = { author: string; text: string; at: string };
type Activity = { actor: string; action: string; at: string };
type Attachment = { name: string; url: string; kind?: string };

type Task = {
  _id: string;
  number: string;
  title: string;
  description: string;
  category: string;
  department: string;
  priority: Priority;
  status: TaskStatus;
  assignees: string[];
  assigneeIds: string[];
  startDate: string;
  dueDate: string;
  estimatedDate: string;
  completedDate: string;
  progress: number;
  subtasks: Subtask[];
  comments: Comment[];
  activity: Activity[];
  attachments: Attachment[];
  internalNotes: string;
  recurrence: string;
  recurEvery: number;
  isTemplate: boolean;
  archived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type Assignee = { id: string; name: string; role: string };
type Me = { id: string; name: string; role: string };
type View = "dashboard" | "list" | "board" | "calendar" | "timeline" | "reports";
type Stats = {
  total: number;
  dueToday: number;
  upcoming: number;
  overdue: number;
  completed: number;
  checklistDone: number;
  checklistTotal: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byEmployee: Record<string, number>;
  byEmployeeItems: Record<string, { done: number; total: number }>;
};

const VIEWS: { key: View; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "list", label: "List" },
  { key: "board", label: "Board" },
  { key: "calendar", label: "Calendar" },
  { key: "timeline", label: "Timeline" },
  { key: "reports", label: "Reports" },
];

const input =
  "mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";
const chip =
  "cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysKey(base: string, days: number) {
  const d = base ? new Date(`${base}T00:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function effStatus(t: Task): TaskStatus {
  return isOverdue(t.dueDate, t.status) ? "overdue" : t.status;
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

function Badge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TASK_STATUS_BADGE[status]}`}>
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PRIORITY_BADGE[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export default function TaskManager() {
  const [me, setMe] = useState<Me | null>(null);
  const isManager = me?.role === "founder-ceo" || me?.role === "founder-sales";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [business, setBusiness] = useState<{ companyName: string; tagline?: string; address?: string; invoiceFooter?: string }>({ companyName: "SOMART" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<"active" | "archived" | "templates">("active");
  const [view, setView] = useState<View>("dashboard");
  const [filters, setFilters] = useState({ q: "", employee: "", department: "", status: "", priority: "", category: "" });

  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [detail, setDetail] = useState<Task | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, tRes, aRes, sRes] = await Promise.all([
        fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/tasks?scope=${scope}`).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/tasks/assignees").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (meRes) setMe(meRes);
      setTasks(Array.isArray(tRes) ? tRes : []);
      setAssignees(Array.isArray(aRes) ? aRes : []);
      if (sRes) setBusiness(sRes);
    } catch {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !`${t.number} ${t.title} ${t.description}`.toLowerCase().includes(q)) return false;
      if (filters.employee && !t.assignees.includes(filters.employee)) return false;
      if (filters.department && t.department !== filters.department) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.status) {
        if (filters.status === "overdue") {
          if (effStatus(t) !== "overdue") return false;
        } else if (t.status !== filters.status) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const stats = useMemo(() => {
    const today = todayKey();
    const soon = addDaysKey(today, 7);
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byEmployee: Record<string, number> = {};
    const byEmployeeItems: Record<string, { done: number; total: number }> = {};
    let dueToday = 0, upcoming = 0, overdue = 0, completed = 0;
    let checklistDone = 0, checklistTotal = 0;
    for (const t of tasks) {
      const es = effStatus(t);
      byStatus[es] = (byStatus[es] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      for (const a of t.assignees) byEmployee[a] = (byEmployee[a] ?? 0) + 1;
      if (t.status === "completed") completed += 1;
      if (es === "overdue") overdue += 1;
      if (t.dueDate === today && t.status !== "completed") dueToday += 1;
      if (t.dueDate > today && t.dueDate <= soon && t.status !== "completed") upcoming += 1;
      const c = taskCompletion(t);
      checklistDone += c.done;
      checklistTotal += c.total;
      // Per-employee scorecard from that person's checklist items.
      for (const a of (t.assignees.length ? t.assignees : ["Unassigned"])) {
        const e = byEmployeeItems[a] ?? { done: 0, total: 0 };
        e.done += c.done;
        e.total += c.total;
        byEmployeeItems[a] = e;
      }
    }
    return { total: tasks.length, dueToday, upcoming, overdue, completed, checklistDone, checklistTotal, byStatus, byPriority, byEmployee, byEmployeeItems };
  }, [tasks]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function saveTask(data: Partial<Task>) {
    const isNew = !data._id;
    const url = isNew ? "/api/tasks" : `/api/tasks/${data._id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Failed to save task");
      return;
    }
    setEditing(null);
    setDetail(null);
    await load();
  }

  // Optimistic update: change the task in place immediately (so counters,
  // status and the board move feel instant), then persist in the background and
  // reconcile with the server's derived values — no full reload, no flicker.
  async function patchTask(id: string, patch: Record<string, unknown>) {
    const merge = (t: Task): Task => ({ ...t, ...(patch as Partial<Task>) });
    setTasks((prev) => prev.map((t) => (t._id === id ? merge(t) : t)));
    setDetail((d) => (d && d._id === id ? merge(d) : d));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Failed to update");
        await load(); // resync (revert the optimistic change)
        return;
      }
      const server = (await res.json()).task as Task;
      setTasks((prev) => prev.map((t) => (t._id === id ? server : t)));
      setDetail((d) => (d && d._id === id ? server : d));
    } catch {
      setError("Failed to update");
      await load();
    }
  }

  async function archiveTask(id: string) {
    await patchTask(id, { archived: true });
    setTasks((prev) => prev.filter((t) => t._id !== id));
    setDetail(null);
  }

  async function duplicateTask(id: string) {
    await fetch(`/api/tasks/${id}/duplicate`, { method: "POST" });
    await load();
  }
  async function deleteTask(id: string) {
    if (!confirm("Delete this task permanently?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setDetail(null);
    await load();
  }

  async function exportPdf() {
    const { exportTasksPdf } = await import("@/lib/taskPdf");
    const kpis: [string, string][] = [
      ["Total", String(stats.total)],
      ["Completed", String(stats.completed)],
      ["Overdue", String(stats.overdue)],
      ["Completion", `${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%`],
    ];
    await exportTasksPdf(filtered, business, { title: "Task Report", subtitle: `${filtered.length} tasks`, kpis });
  }
  async function blankSheet() {
    const { exportBlankPlanningSheet } = await import("@/lib/taskPdf");
    await exportBlankPlanningSheet(business);
  }

  // Per-employee task report: name, role, task counts, and every task with its
  // priority, status and checklist progress.
  async function employeeReport() {
    const { exportEmployeeTaskReport } = await import("@/lib/taskPdf");
    const roleByName = new Map(assignees.map((a) => [a.name, a.role]));
    type Block = { taskName: string; items: { name: string; priority: string; dueDate?: string; done: number; target: number; status: string }[] };
    const groups = new Map<string, Block[]>();
    for (const t of tasks) {
      const names = t.assignees.length ? t.assignees : ["Unassigned"];
      const items = (t.subtasks ?? []).map((s) => {
        const u = itemUnits(s);
        return { name: s.title, priority: s.priority ?? "medium", dueDate: s.dueDate, done: u.done, target: u.target, status: deriveItemStatus(u.done, u.target) };
      });
      for (const n of names) {
        if (!groups.has(n)) groups.set(n, []);
        groups.get(n)!.push({ taskName: t.title, items });
      }
    }
    const data = [...groups.entries()]
      .sort((a, b) => (a[0] === "Unassigned" ? 1 : b[0] === "Unassigned" ? -1 : a[0].localeCompare(b[0])))
      .map(([name, tks]) => ({
        name,
        roleLabel: ROLE_LABELS[roleByName.get(name) as Role] ?? "—",
        tasks: tks,
      }));
    await exportEmployeeTaskReport(data, business);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">Task Manager</p>
          <h1 className="mt-1 text-3xl font-semibold">Plan, assign &amp; track work</h1>
          <p className="mt-1 text-sm text-muted">
            {isManager ? "Create tasks, assign your team and monitor progress." : "Your assigned tasks — update progress and add comments."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={blankSheet} className={`${chip} border border-line text-muted hover:border-gold hover:text-gold`}>
            ⬇ Blank Sheet
          </button>
          <button onClick={exportPdf} className={`${chip} border border-line text-muted hover:border-gold hover:text-gold`}>
            ⬇ Export PDF
          </button>
          {isManager && (
            <button onClick={employeeReport} title="Download a per-employee task report (PDF)" className={`${chip} border border-line text-muted hover:border-gold hover:text-gold`}>
              📄 Employee Report
            </button>
          )}
          {isManager && (
            <button onClick={() => setEditing({})} className={`${chip} bg-foreground text-background hover:opacity-90`}>
              + New Task
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* View tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`${chip} ${view === v.key ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"}`}
          >
            {v.label}
          </button>
        ))}
        {isManager && (
          <div className="ml-auto flex gap-2">
            {(["active", "templates", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`${chip} ${scope === s ? "bg-gold/20 text-gold" : "border border-line text-muted hover:border-gold hover:text-gold"}`}
              >
                {labelize(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-muted">Loading tasks…</p>
      ) : (
        <div className="mt-6">
          {view === "dashboard" && <Dashboard stats={stats} />}
          {view !== "dashboard" && view !== "reports" && (
            <Filters filters={filters} setFilters={setFilters} assignees={assignees} tasks={tasks} />
          )}
          {view === "list" && <ListView tasks={filtered} onOpen={setDetail} />}
          {view === "board" && (
            <BoardView tasks={filtered} isManager={isManager} onOpen={setDetail} onMove={(id, status) => patchTask(id, { status })} />
          )}
          {view === "calendar" && <CalendarView tasks={filtered} month={calMonth} setMonth={setCalMonth} onOpen={setDetail} />}
          {view === "timeline" && <TimelineView tasks={filtered} onOpen={setDetail} />}
          {view === "reports" && <Reports tasks={tasks} onExport={exportPdf} onBlank={blankSheet} onEmployeeReport={employeeReport} />}
        </div>
      )}

      {editing && (
        <TaskModal
          initial={editing}
          assignees={assignees}
          onClose={() => setEditing(null)}
          onSave={saveTask}
        />
      )}
      {detail && (
        <TaskDetail
          task={detail}
          isManager={isManager}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); }}
          onPatch={patchTask}
          onDuplicate={duplicateTask}
          onDelete={deleteTask}
          onArchive={archiveTask}
        />
      )}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ stats }: { stats: Stats }) {
  const completionRate = stats.checklistTotal ? Math.round((stats.checklistDone / stats.checklistTotal) * 100) : 0;
  const maxStatus = Math.max(1, ...Object.values(stats.byStatus));
  const scorecard = Object.entries(stats.byEmployeeItems)
    .map(([name, v]) => ({ name, done: v.done, total: v.total, pct: v.total ? Math.round((v.done / v.total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Tasks" value={stats.total} accent />
        <StatCard label="Due Today" value={stats.dueToday} />
        <StatCard label="Upcoming (7d)" value={stats.upcoming} />
        <StatCard label="Overdue" value={stats.overdue} accent />
        <StatCard label="Completed" value={stats.completed} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Tasks by Status</h2>
          <ul className="mt-4 space-y-2.5">
            {TASK_STATUSES.map((s) => {
              const n = stats.byStatus[s] ?? 0;
              return (
                <li key={s} className="text-sm">
                  <div className="flex items-center justify-between">
                    <Badge status={s} />
                    <span className="font-semibold">{n}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-gold-bright/80" style={{ width: `${(n / maxStatus) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">Completion Rate</h2>
            <p className="mt-2 text-4xl font-bold text-gold">{completionRate}%</p>
            <p className="mt-1 text-xs text-muted">{stats.checklistDone} of {stats.checklistTotal} checklist items completed</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-gold-bright/80" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">Tasks by Priority</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {PRIORITIES.map((p) => (
                <div key={p} className="flex items-center gap-2">
                  <PriorityBadge priority={p} />
                  <span className="text-sm font-semibold">{stats.byPriority[p] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">Employee Scorecard</h2>
            <p className="mt-1 text-xs text-muted">Completed vs total checklist items (all time)</p>
            {scorecard.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No assignments yet.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {scorecard.map((s) => (
                  <li key={s.name}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-muted">
                        <span className="font-bold text-foreground">{s.done}</span>/{s.total}
                        <span className="ml-2 font-bold text-gold">{s.pct}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-gold-bright/80" style={{ width: `${s.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Filters bar ────────────────────────────────────────────────────────────
function Filters({ filters, setFilters, assignees, tasks }: {
  filters: { q: string; employee: string; department: string; status: string; priority: string; category: string };
  setFilters: (f: typeof filters) => void;
  assignees: Assignee[];
  tasks: Task[];
}) {
  const categories = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean)));
  const set = (k: string, v: string) => setFilters({ ...filters, [k]: v });
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={filters.q}
        onChange={(e) => set("q", e.target.value)}
        placeholder="Search tasks…"
        className="w-full max-w-xs rounded-xl border border-line bg-surface px-4 py-2.5 text-sm focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40"
      />
      <select value={filters.employee} onChange={(e) => set("employee", e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
        <option value="">All employees</option>
        {assignees.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
      </select>
      <select value={filters.department} onChange={(e) => set("department", e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
        <option value="">All departments</option>
        {DEPARTMENTS.map((d) => <option key={d} value={d}>{labelize(d)}</option>)}
      </select>
      <select value={filters.status} onChange={(e) => set("status", e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
        <option value="">All statuses</option>
        {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
      </select>
      <select value={filters.priority} onChange={(e) => set("priority", e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
      </select>
      {categories.length > 0 && (
        <select value={filters.category} onChange={(e) => set("category", e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  );
}

// ── List view — grouped per person (each employee's weekly tasks) ────────────
function ListView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  if (tasks.length === 0) return <p className="text-sm text-muted">No tasks match your filters.</p>;

  // Group tasks by assignee (a task shows under each of its assignees).
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const names = t.assignees.length ? t.assignees : ["Unassigned"];
    for (const n of names) {
      if (!groups.has(n)) groups.set(n, []);
      groups.get(n)!.push(t);
    }
  }
  const ordered = [...groups.entries()].sort((a, b) =>
    a[0] === "Unassigned" ? 1 : b[0] === "Unassigned" ? -1 : a[0].localeCompare(b[0])
  );

  return (
    <div className="space-y-5">
      {ordered.map(([person, list]) => {
        const done = list.reduce((s, t) => s + taskCompletion(t).done, 0);
        const total = list.reduce((s, t) => s + taskCompletion(t).total, 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <div key={person} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-sm font-bold text-gold">
                  {person.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{person}</p>
                  <p className="text-xs text-muted">{list.length} task{list.length === 1 ? "" : "s"} · {done}/{total} checklist items done</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-gold-bright/80" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-bold text-gold">{pct}%</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {list.map((t) => {
                const c = taskCompletion(t);
                return (
                  <button key={t._id} onClick={() => onOpen(t)}
                    className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-background p-3 text-left hover:border-gold">
                    <span className="font-mono text-[10px] text-muted">{t.number}</span>
                    <span className="flex-1 font-semibold">{t.title}</span>
                    <PriorityBadge priority={t.priority} />
                    <Badge status={effStatus(t)} />
                    <span className="text-xs text-muted">Due {fmtDate(t.dueDate)}</span>
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface">
                        <span className="block h-full rounded-full bg-gold-bright/80" style={{ width: `${c.percent}%` }} />
                      </span>
                      <span className="text-xs text-muted">{c.total ? `${c.done}/${c.total}` : `${c.percent}%`}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Kanban board (drag to move for managers) ─────────────────────────────────
function BoardView({ tasks, isManager, onOpen, onMove }: {
  tasks: Task[];
  isManager: boolean;
  onOpen: (t: Task) => void;
  onMove: (id: string, status: TaskStatus) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {KANBAN_STATUSES.map((col) => {
        const items = tasks.filter((t) => (col === "overdue" ? effStatus(t) === "overdue" : t.status === col));
        return (
          <div
            key={col}
            onDragOver={(e) => isManager && e.preventDefault()}
            onDrop={() => { if (isManager && dragId) { onMove(dragId, col); setDragId(null); } }}
            className="rounded-2xl border border-line bg-surface/40 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <Badge status={col} />
              <span className="text-xs font-semibold text-muted">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <div
                  key={t._id}
                  draggable={isManager}
                  onDragStart={() => setDragId(t._id)}
                  onClick={() => onOpen(t)}
                  className="cursor-pointer rounded-xl border border-line bg-background p-3 hover:border-gold"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-muted">{t.number}</span>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <p className="mt-1 text-sm font-semibold">{t.title}</p>
                  <p className="mt-1 text-xs text-muted">{t.assignees.join(", ") || "Unassigned"}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                    <span>Due {fmtDate(t.dueDate)}</span>
                    <span>{(() => { const c = taskCompletion(t); return c.total ? `${c.done}/${c.total}` : `${c.percent}%`; })()}</span>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="py-4 text-center text-xs text-muted">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Calendar view ────────────────────────────────────────────────────────────
function CalendarView({ tasks, month, setMonth, onOpen }: {
  tasks: Task[];
  month: Date;
  setMonth: (d: Date) => void;
  onOpen: (t: Task) => void;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    if (!byDay.has(t.dueDate)) byDay.set(t.dueDate, []);
    byDay.get(t.dueDate)!.push(t);
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setMonth(new Date(year, m - 1, 1))} className="rounded-full border border-line px-3 py-1 text-sm hover:border-gold">←</button>
        <h2 className="text-lg font-semibold">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        <button onClick={() => setMonth(new Date(year, m + 1, 1))} className="rounded-full border border-line px-3 py-1 text-sm hover:border-gold">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className={`min-h-[84px] rounded-lg border p-1 ${day === todayKey() ? "border-gold" : "border-line"} ${day ? "bg-background" : "bg-transparent"}`}>
            {day && <div className="text-[10px] text-muted">{Number(day.slice(-2))}</div>}
            <div className="mt-0.5 space-y-1">
              {(byDay.get(day ?? "") ?? []).slice(0, 3).map((t) => (
                <button key={t._id} onClick={() => onOpen(t)} className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold ${TASK_STATUS_BADGE[effStatus(t)]}`}>
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Timeline (simple Gantt) ──────────────────────────────────────────────────
function TimelineView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const dated = tasks.filter((t) => t.startDate || t.dueDate);
  if (dated.length === 0) return <p className="text-sm text-muted">No tasks with dates to show on a timeline.</p>;
  const all = dated.flatMap((t) => [t.startDate, t.dueDate].filter(Boolean)) as string[];
  const min = all.reduce((a, b) => (a < b ? a : b));
  const max = all.reduce((a, b) => (a > b ? a : b));
  const minMs = new Date(`${min}T00:00:00`).getTime();
  const maxMs = new Date(`${max}T00:00:00`).getTime();
  const span = Math.max(1, maxMs - minMs);
  const pos = (d: string) => ((new Date(`${d}T00:00:00`).getTime() - minMs) / span) * 100;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex justify-between text-xs text-muted">
        <span>{fmtDate(min)}</span>
        <span>{fmtDate(max)}</span>
      </div>
      <div className="space-y-2">
        {dated.map((t) => {
          const s = pos(t.startDate || t.dueDate);
          const e = pos(t.dueDate || t.startDate);
          const left = Math.min(s, e);
          const width = Math.max(3, Math.abs(e - s));
          return (
            <div key={t._id} className="flex items-center gap-3">
              <button onClick={() => onOpen(t)} className="w-40 shrink-0 truncate text-left text-xs font-semibold hover:text-gold">{t.title}</button>
              <div className="relative h-5 flex-1 rounded bg-background">
                <div
                  onClick={() => onOpen(t)}
                  className="absolute top-0 h-5 cursor-pointer rounded bg-gold-bright/80"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${fmtDate(t.startDate)} → ${fmtDate(t.dueDate)}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────
function Reports({ tasks, onExport, onBlank, onEmployeeReport }: { tasks: Task[]; onExport: () => void; onBlank: () => void; onEmployeeReport: () => void }) {
  const completed = tasks.filter((t) => t.status === "completed");
  const open = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const overdue = tasks.filter((t) => effStatus(t) === "overdue");
  const rate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;
  const avgDays = (() => {
    const spans = completed
      .filter((t) => t.completedDate && t.createdAt)
      .map((t) => (new Date(`${t.completedDate}T00:00:00`).getTime() - new Date(t.createdAt).getTime()) / 86400000)
      .filter((n) => n >= 0);
    return spans.length ? (spans.reduce((a, b) => a + b, 0) / spans.length).toFixed(1) : "—";
  })();
  const productivity = (() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of tasks) for (const a of t.assignees) {
      const e = map.get(a) ?? { done: 0, total: 0 };
      e.total += 1;
      if (t.status === "completed") e.done += 1;
      map.set(a, e);
    }
    return [...map.entries()].sort((a, b) => b[1].done - a[1].done);
  })();
  return (
    <div>
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onBlank} className={`${chip} border border-line text-muted hover:border-gold hover:text-gold`}>⬇ Blank Sheet</button>
        <button onClick={onExport} className={`${chip} border border-line text-muted hover:border-gold hover:text-gold`}>⬇ Export PDF</button>
        <button onClick={onEmployeeReport} className={`${chip} bg-foreground text-background hover:opacity-90`}>📄 Employee Report (PDF)</button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Completion Rate" value={`${rate}%`} accent />
        <StatCard label="Completed" value={completed.length} />
        <StatCard label="Open" value={open.length} />
        <StatCard label="Overdue" value={overdue.length} accent />
        <StatCard label="Avg Completion (days)" value={avgDays} />
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Employee Productivity</h2>
        {productivity.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No assignments yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr><th className="py-2">Employee</th><th className="py-2">Completed</th><th className="py-2">Assigned</th><th className="py-2">Rate</th></tr>
            </thead>
            <tbody>
              {productivity.map(([name, e]) => (
                <tr key={name} className="border-t border-line">
                  <td className="py-2 font-semibold">{name}</td>
                  <td className="py-2">{e.done}</td>
                  <td className="py-2">{e.total}</td>
                  <td className="py-2 text-gold">{e.total ? Math.round((e.done / e.total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Create / edit modal ──────────────────────────────────────────────────────
function TaskModal({ initial, assignees, onClose, onSave }: {
  initial: Partial<Task>;
  assignees: Assignee[];
  onClose: () => void;
  onSave: (data: Partial<Task>) => void;
}) {
  const [f, setF] = useState<Partial<Task>>({
    title: "", description: "", category: "General", department: "management",
    priority: "medium", status: "not-started", startDate: "", dueDate: "", estimatedDate: "",
    progress: 0, recurrence: "none", recurEvery: 1, internalNotes: "", isTemplate: false,
    subtasks: [], assignees: [], assigneeIds: [],
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Task, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  // One employee per task.
  function selectAssignee(a: Assignee) {
    const on = (f.assigneeIds ?? [])[0] === a.id;
    setF((p) => ({ ...p, assigneeIds: on ? [] : [a.id], assignees: on ? [] : [a.name] }));
  }

  async function submit() {
    if (!f.title?.trim()) return;
    setSaving(true);
    await onSave(f);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-line bg-background p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold">{f._id ? "Edit Task" : "New Task"}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold">Title *</label>
            <input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold">Description</label>
            <textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} className={input} />
          </div>
          <div>
            <label className="text-sm font-semibold">Category</label>
            <input list="tm-cats" value={f.category ?? ""} onChange={(e) => set("category", e.target.value)} className={input} />
            <datalist id="tm-cats">{TASK_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="text-sm font-semibold">Department</label>
            <select value={f.department} onChange={(e) => set("department", e.target.value)} className={input}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{labelize(d)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">Priority</label>
            <select value={f.priority} onChange={(e) => set("priority", e.target.value)} className={input}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">Status</label>
            <select value={f.status} onChange={(e) => set("status", e.target.value)} className={input}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">Start Date</label>
            <input type="date" value={f.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} className={input} />
          </div>
          <div>
            <label className="text-sm font-semibold">Due Date</label>
            <input type="date" value={f.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value)} className={input} />
          </div>
          <div>
            <label className="text-sm font-semibold">Estimated Completion</label>
            <input type="date" value={f.estimatedDate ?? ""} onChange={(e) => set("estimatedDate", e.target.value)} className={input} />
          </div>
          <div>
            <label className="text-sm font-semibold">Progress ({f.progress ?? 0}%)</label>
            <input type="range" min={0} max={100} step={5} value={f.progress ?? 0} onChange={(e) => set("progress", Number(e.target.value))} className="mt-3 w-full" />
          </div>
          <div>
            <label className="text-sm font-semibold">Repeats</label>
            <select value={f.recurrence} onChange={(e) => set("recurrence", e.target.value)} className={input}>
              {RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
            </select>
          </div>
          {f.recurrence === "custom" && (
            <div>
              <label className="text-sm font-semibold">Every N days</label>
              <input type="number" min={1} value={f.recurEvery ?? 1} onChange={(e) => set("recurEvery", Number(e.target.value))} className={input} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold">Assign to <span className="font-normal text-muted">(one employee)</span></label>
            <div className="mt-2 flex flex-wrap gap-2">
              {assignees.length === 0 && <span className="text-sm text-muted">No employees found.</span>}
              {assignees.map((a) => {
                const on = (f.assigneeIds ?? [])[0] === a.id;
                return (
                  <button key={a.id} type="button" onClick={() => selectAssignee(a)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-gold/20 text-gold" : "border border-line text-muted hover:border-gold"}`}>
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <SubtaskEditor value={f.subtasks ?? []} onChange={(v) => set("subtasks", v)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold">Internal Notes</label>
            <textarea value={f.internalNotes ?? ""} onChange={(e) => set("internalNotes", e.target.value)} rows={2} className={input} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.isTemplate} onChange={(e) => set("isTemplate", e.target.checked)} />
            Save as reusable template
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className={`${chip} border border-line text-muted hover:border-gold`}>Cancel</button>
          <button onClick={submit} disabled={saving || !f.title?.trim()} className={`${chip} bg-foreground text-background hover:opacity-90 disabled:opacity-50`}>
            {saving ? "Saving…" : "Save Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubtaskEditor({ value, onChange }: { value: Subtask[]; onChange: (v: Subtask[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    if (text.trim()) { onChange([...value, { title: text.trim(), priority: "medium", dueDate: "", target: 1, doneCount: 0, status: "not-started" }]); setText(""); }
  };
  const upd = (i: number, patch: Partial<Subtask>) =>
    onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div>
      <label className="text-sm font-semibold">Task list (name, priority, due date &amp; how many needed)</label>
      <p className="text-xs text-muted">Status is automatic — the employee records how many they did (e.g. 3 videos → 2/3 → In Progress).</p>
      <div className="mt-2 space-y-2">
        {value.map((s, i) => (
          <div key={i} className="rounded-xl border border-line p-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted">{i + 1}.</span>
              <input value={s.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Item name (e.g. Facebook ads)"
                className="flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-sm" />
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-sm text-red-400">×</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-5">
              <select value={s.priority ?? "medium"} onChange={(e) => upd(i, { priority: e.target.value as Priority })} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs">
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
              <input type="date" value={s.dueDate ?? ""} onChange={(e) => upd(i, { dueDate: e.target.value })} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs" />
              <label className="flex items-center gap-1 text-xs text-muted">
                How many:
                <input
                  type="number"
                  min={1}
                  value={s.target ?? ""}
                  onChange={(e) => upd(i, { target: e.target.value === "" ? undefined : Number(e.target.value) })}
                  onBlur={(e) => upd(i, { target: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                  className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a list item (e.g. Post 3 videos)…"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        <button type="button" onClick={add} className={`${chip} border border-line text-muted hover:border-gold`}>Add</button>
      </div>
    </div>
  );
}

// ── Detail drawer ────────────────────────────────────────────────────────────
function TaskDetail({ task, isManager, onClose, onEdit, onPatch, onDuplicate, onDelete, onArchive }: {
  task: Task;
  isManager: boolean;
  onClose: () => void;
  onEdit: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [progress, setProgress] = useState(task.progress);
  const [attName, setAttName] = useState("");
  const [attUrl, setAttUrl] = useState("");
  const comp = taskCompletion(task);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto border-l border-line bg-background p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs text-muted">{task.number}</span>
            <h2 className="text-xl font-semibold">{task.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge status={effStatus(task)} />
              <PriorityBadge priority={task.priority} />
              <span className="text-xs text-muted">{labelize(task.department)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-muted hover:text-foreground">×</button>
        </div>

        {task.description && <p className="mt-4 text-sm text-muted">{task.description}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs uppercase text-muted">Assigned</dt><dd className="font-semibold">{task.assignees.join(", ") || "—"}</dd></div>
          <div><dt className="text-xs uppercase text-muted">Category</dt><dd className="font-semibold">{task.category}</dd></div>
          <div><dt className="text-xs uppercase text-muted">Start</dt><dd className="font-semibold">{fmtDate(task.startDate)}</dd></div>
          <div><dt className="text-xs uppercase text-muted">Due</dt><dd className="font-semibold">{fmtDate(task.dueDate)}</dd></div>
          <div><dt className="text-xs uppercase text-muted">Estimated</dt><dd className="font-semibold">{fmtDate(task.estimatedDate)}</dd></div>
          <div><dt className="text-xs uppercase text-muted">Completed</dt><dd className="font-semibold">{fmtDate(task.completedDate)}</dd></div>
        </dl>

        {/* Progress + status controls (managers or assignee) */}
        <div className="mt-5 rounded-xl border border-line p-3">
          <label className="text-sm font-semibold">Progress: {progress}%</label>
          <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))}
            onMouseUp={() => onPatch(task._id, { progress })} onTouchEnd={() => onPatch(task._id, { progress })} className="mt-2 w-full" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={task.status} onChange={(e) => onPatch(task._id, { status: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
            </select>
            {task.status !== "completed" && (
              <button onClick={() => onPatch(task._id, { status: "completed" })} className={`${chip} bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25`}>✓ Complete</button>
            )}
          </div>
        </div>

        {/* Task list — each item has its own name, priority, due date & status.
            Once an item's due date passes it locks for employees (managers only). */}
        {task.subtasks.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Task list</h3>
              <span className="text-xs font-semibold text-gold">{comp.done}/{comp.total} done · {comp.percent}%</span>
            </div>
            <div className="mt-2 space-y-2">
              {task.subtasks.map((s, i) => {
                const u = itemUnits(s);
                const st = deriveItemStatus(u.done, u.target);
                const pastDue = itemPastDue(s.dueDate);
                const locked = pastDue && !isManager;
                const setCount = (n: number) =>
                  onPatch(task._id, { subtasks: task.subtasks.map((x, j) => j === i ? { ...x, doneCount: Math.max(0, Math.min(u.target, n)) } : x) });
                return (
                  <div key={i} className="rounded-xl border border-line p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted">{i + 1}.</span>
                      <span className={`flex-1 text-sm ${st === "completed" ? "text-muted line-through" : ""}`}>{s.title}</span>
                      <PriorityBadge priority={s.priority ?? "medium"} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 pl-5">
                      <span className={`text-xs ${pastDue && st !== "completed" ? "font-semibold text-red-400" : "text-muted"}`}>
                        Due {fmtDate(s.dueDate)}{locked ? " · 🔒 locked" : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${CHECKLIST_STATUS_BADGE[st]}`}>{CHECKLIST_STATUS_LABELS[st]}</span>
                        <div className="flex items-center gap-1.5" title={locked ? "Past the due date — only a manager can change this" : undefined}>
                          <button type="button" disabled={locked || u.done <= 0} onClick={() => setCount(u.done - 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-sm disabled:opacity-40">−</button>
                          <span className="min-w-[34px] text-center text-sm font-bold">{u.done}/{u.target}</span>
                          <button type="button" disabled={locked || u.done >= u.target} onClick={() => setCount(u.done + 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-sm disabled:opacity-40">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!isManager && task.subtasks.some((s) => itemPastDue(s.dueDate)) && (
              <p className="mt-2 text-xs text-muted">🔒 Past-due items are locked — only a manager can change them.</p>
            )}
          </div>
        )}

        {/* Attachments */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Attachments</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {task.attachments.map((a, i) => (
              <li key={i}><a href={a.url} target="_blank" rel="noreferrer" className="text-gold hover:underline">📎 {a.name || a.url}</a></li>
            ))}
            {task.attachments.length === 0 && <li className="text-xs text-muted">No attachments.</li>}
          </ul>
          <div className="mt-2 flex gap-2">
            <input value={attName} onChange={(e) => setAttName(e.target.value)} placeholder="Label" className="w-28 rounded-xl border border-line bg-surface px-2 py-1.5 text-sm" />
            <input value={attUrl} onChange={(e) => setAttUrl(e.target.value)} placeholder="https://…" className="flex-1 rounded-xl border border-line bg-surface px-2 py-1.5 text-sm" />
            <button onClick={() => { if (attUrl.trim()) { onPatch(task._id, { attachments: [...task.attachments, { name: attName.trim(), url: attUrl.trim() }] }); setAttName(""); setAttUrl(""); } }}
              className={`${chip} border border-line text-muted hover:border-gold`}>Add</button>
          </div>
        </div>

        {/* Comments */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Comments</h3>
          <div className="mt-2 space-y-2">
            {task.comments.map((c, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-2 text-sm">
                <div className="flex justify-between text-xs text-muted"><span className="font-semibold text-foreground">{c.author}</span><span>{fmtDate(String(c.at).slice(0, 10))}</span></div>
                <p className="mt-1">{c.text}</p>
              </div>
            ))}
            {task.comments.length === 0 && <p className="text-xs text-muted">No comments yet.</p>}
          </div>
          <div className="mt-2 flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { onPatch(task._id, { addComment: comment }); setComment(""); } }} />
            <button onClick={() => { if (comment.trim()) { onPatch(task._id, { addComment: comment }); setComment(""); } }} className={`${chip} bg-foreground text-background hover:opacity-90`}>Send</button>
          </div>
        </div>

        {/* Activity */}
        {task.activity.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">Activity</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {[...task.activity].reverse().map((a, i) => (
                <li key={i}>• <span className="text-foreground">{a.actor}</span> {a.action} — {fmtDate(String(a.at).slice(0, 10))}</li>
              ))}
            </ul>
          </div>
        )}

        {isManager && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
            <button onClick={onEdit} className={`${chip} border border-line text-muted hover:border-gold`}>Edit</button>
            <button onClick={() => onDuplicate(task._id)} className={`${chip} border border-line text-muted hover:border-gold`}>Duplicate</button>
            {!task.archived && <button onClick={() => onArchive(task._id)} className={`${chip} border border-line text-muted hover:border-gold`}>Archive</button>}
            <button onClick={() => onDelete(task._id)} className={`${chip} bg-red-500/15 text-red-400 hover:bg-red-500/25`}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}
