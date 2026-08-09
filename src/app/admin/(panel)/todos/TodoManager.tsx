"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PlusIcon, TrashIcon, XIcon, PencilIcon } from "@/components/icons";
import { confirmDialog } from "@/components/admin/ConfirmDialog";
import {
  TODO_TYPES,
  TODO_TYPE_LABELS,
  TODO_TYPE_BADGE,
  TODO_STATUS_LABELS,
  TODO_STATUS_BADGE,
  itemUnits,
  todoProgress,
  todoStatus,
  type TodoType,
} from "@/lib/todoList";

type Item = { title: string; target?: number; doneCount?: number; done?: boolean };
type Todo = {
  _id: string;
  number: string;
  title: string;
  type: TodoType;
  notes?: string;
  dueDate?: string;
  items: Item[];
  createdAt: string;
};
type Business = { companyName: string; tagline?: string; address?: string; invoiceFooter?: string };

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";
const chip = "cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200";

function fmt(v?: string) {
  if (!v) return "No deadline";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const emptyForm = { title: "", type: "general" as TodoType, dueDate: "", notes: "", items: [] as Item[] };

export default function TodoManager() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [business, setBusiness] = useState<Business>({ companyName: "SOMART" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TodoType | "">("");

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([fetch("/api/todos"), fetch("/api/settings")]);
      if (!tRes.ok) throw new Error("Failed to load to-do lists");
      setTodos(await tRes.json());
      if (sRes.ok) setBusiness(await sRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const visible = typeFilter ? todos.filter((t) => t.type === typeFilter) : todos;
  const stats = {
    total: todos.length,
    open: todos.filter((t) => todoStatus(t) === "open").length,
    overdue: todos.filter((t) => todoStatus(t) === "overdue").length,
    done: todos.filter((t) => todoStatus(t) === "done").length,
  };

  function openNew() {
    setEditId(null);
    setForm({ ...emptyForm, items: [{ title: "", target: 1 }] });
    setError(null);
    setOpen(true);
  }
  function openEdit(t: Todo) {
    setEditId(t._id);
    setForm({
      title: t.title,
      type: t.type,
      dueDate: t.dueDate ?? "",
      notes: t.notes ?? "",
      items: t.items.map((i) => ({ title: i.title, target: i.target ?? 1, doneCount: i.doneCount ?? 0 })),
    });
    setError(null);
    setOpen(true);
  }

  // Optimistic PATCH so ticking an item feels instant.
  async function patchTodo(id: string, patch: Partial<Todo>) {
    setTodos((prev) => prev.map((t) => (t._id === id ? { ...t, ...patch } : t)));
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
      const server = (await res.json()) as Todo;
      setTodos((prev) => prev.map((t) => (t._id === id ? server : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      load();
    }
  }

  function setItemCount(t: Todo, index: number, n: number) {
    const u = itemUnits(t.items[index]);
    const items = t.items.map((it, j) => (j === index ? { ...it, doneCount: Math.max(0, Math.min(u.target, n)) } : it));
    patchTodo(t._id, { items });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Give the list a title");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      type: form.type,
      dueDate: form.dueDate,
      notes: form.notes,
      items: form.items.filter((i) => i.title.trim()).map((i) => ({ ...i, title: i.title.trim(), target: Math.max(1, Math.floor(Number(i.target) || 1)) })),
    };
    try {
      const res = await fetch(editId ? `/api/todos/${editId}` : "/api/todos", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setOpen(false);
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: Todo) {
    if (!(await confirmDialog(`Delete to-do list "${t.title}"?`))) return;
    try {
      const res = await fetch(`/api/todos/${t._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      setTodos((prev) => prev.filter((x) => x._id !== t._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function downloadPdf(t: Todo) {
    setError(null);
    try {
      const { exportTodoPdf } = await import("@/lib/todoPdf");
      await exportTodoPdf(t, business);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF failed");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">Task Manager</p>
          <h1 className="mt-1 text-3xl font-semibold">Business To-Do List</h1>
          <p className="mt-1 text-sm text-muted">
            Simple checklists for the business — stock orders, marketing pushes, sales targets. Track the deadline and how much is done.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
        >
          <PlusIcon className="h-4 w-4" /> New List
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total lists", value: stats.total },
          { label: "Open", value: stats.open },
          { label: "Overdue", value: stats.overdue },
          { label: "Done", value: stats.done },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{s.label}</p>
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTypeFilter("")} className={`${chip} ${typeFilter === "" ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"}`}>
          All
        </button>
        {TODO_TYPES.map((ty) => (
          <button key={ty} type="button" onClick={() => setTypeFilter(ty)} className={`${chip} ${typeFilter === ty ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"}`}>
            {TODO_TYPE_LABELS[ty]}
          </button>
        ))}
      </div>

      {error && !open && (
        <p role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>
      )}

      {loading ? (
        <div className="mt-8 grid gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />)}</div>
      ) : visible.length === 0 ? (
        <p className="mt-10 text-center text-muted">
          {todos.length === 0 ? "No to-do lists yet — create your first one." : "No lists of this type."}
        </p>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {visible.map((t) => {
            const prog = todoProgress(t.items);
            const status = todoStatus(t);
            const overdue = status === "overdue";
            return (
              <div key={t._id} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TODO_TYPE_BADGE[t.type]}`}>{TODO_TYPE_LABELS[t.type]}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TODO_STATUS_BADGE[status]}`}>{TODO_STATUS_LABELS[status]}</span>
                    </div>
                    <h3 className="mt-2 truncate text-lg font-bold">{t.title}</h3>
                    <p className={`text-xs ${overdue ? "font-semibold text-red-400" : "text-muted"}`}>
                      {t.number} · Deadline: {fmt(t.dueDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => downloadPdf(t)} title="Download PDF" className="cursor-pointer rounded-lg border border-line px-2 py-1 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold">⬇ PDF</button>
                    <button type="button" onClick={() => openEdit(t)} aria-label="Edit" className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-background hover:text-gold"><PencilIcon className="h-4 w-4" /></button>
                    <button type="button" onClick={() => handleDelete(t)} aria-label="Delete" className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-background hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gold">{prog.done}/{prog.total} done · {prog.percent}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-gold-bright/80 transition-all duration-500" style={{ width: `${prog.percent}%` }} />
                </div>

                {t.items.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {t.items.map((it, i) => {
                      const u = itemUnits(it);
                      const done = u.done >= u.target;
                      return (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5">
                          <span className={`flex-1 truncate text-sm ${done ? "text-muted line-through" : ""}`}>{it.title || "—"}</span>
                          {u.target === 1 ? (
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => setItemCount(t, i, done ? 0 : 1)}
                              className="h-4.5 w-4.5 cursor-pointer accent-gold-bright"
                              aria-label={`Mark ${it.title} done`}
                            />
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <button type="button" onClick={() => setItemCount(t, i, u.done - 1)} disabled={u.done <= 0} className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-sm disabled:opacity-40">−</button>
                              <span className="min-w-[42px] text-center text-sm font-bold">{u.done}/{u.target}</span>
                              <button type="button" onClick={() => setItemCount(t, i, u.done + 1)} disabled={u.done >= u.target} className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-sm disabled:opacity-40">+</button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {t.notes && <p className="mt-3 text-sm text-muted">{t.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <form onSubmit={handleSave} className="animate-fade-up my-8 w-full max-w-lg rounded-3xl border border-line bg-background p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">{editId ? "Edit list" : "New to-do list"}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface"><XIcon className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="td-title" className="text-sm font-semibold">Title</label>
                <input id="td-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Restock sunglasses" className={inputClass} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="td-type" className="text-sm font-semibold">Type <span className="font-normal text-muted">(what it is)</span></label>
                  <select id="td-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TodoType }))} className={inputClass}>
                    {TODO_TYPES.map((ty) => <option key={ty} value={ty}>{TODO_TYPE_LABELS[ty]}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="td-due" className="text-sm font-semibold">Deadline</label>
                  <input id="td-due" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Checklist</span>
                  <span className="text-xs text-muted">Set a target &gt; 1 for counts (e.g. 40 orders)</span>
                </div>
                <div className="mt-2 space-y-2">
                  {form.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={it.title} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) }))} placeholder={`Item ${i + 1} (e.g. Orders)`} className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
                      <input type="number" min={1} value={it.target ?? 1} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, target: e.target.value === "" ? undefined : Number(e.target.value) } : x)) }))} className="w-20 rounded-xl border border-line bg-surface px-3 py-2 text-sm" aria-label="Target" />
                      <button type="button" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))} aria-label="Remove" className="shrink-0 cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { title: "", target: 1 }] }))} className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-gold hover:underline">+ Add item</button>
                </div>
              </div>

              <div>
                <label htmlFor="td-notes" className="text-sm font-semibold">Notes <span className="font-normal text-muted">(optional)</span></label>
                <input id="td-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputClass} />
              </div>
            </div>

            {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="cursor-pointer rounded-full border border-line px-6 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold">Cancel</button>
              <button type="submit" disabled={saving} className="cursor-pointer rounded-full bg-gold-bright px-7 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : editId ? "Save" : "Create"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
