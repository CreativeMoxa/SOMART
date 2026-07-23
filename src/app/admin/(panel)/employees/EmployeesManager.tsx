"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { confirmDialog } from "@/components/admin/ConfirmDialog";
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/lib/roles";
import {
  EyeIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from "@/components/icons";

type EmployeeStatus = "active" | "inactive" | "suspended";

type Employee = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  role: Role;
  status: EmployeeStatus;
  lastLoginAt?: string | null;
  registeredAt?: string | null;
  allowMultipleDevices?: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

const STATUS_META: Record<EmployeeStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/15 text-emerald-500" },
  inactive: { label: "Inactive", cls: "bg-slate-500/15 text-slate-400" },
  suspended: { label: "Suspended", cls: "bg-red-500/15 text-red-500" },
};

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  photoUrl: "",
  role: "cashier" as Role,
  status: "active" as EmployeeStatus,
  allowMultipleDevices: true,
  sendInvite: true,
};
type FormState = typeof emptyForm;

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function fmtDateTime(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type ActivityEntry = {
  _id: string;
  employeeName?: string;
  employeeRole: Role;
  action: string;
  module?: string;
  reference?: string;
  ip?: string;
  device?: string;
  createdAt: string;
};

export default function EmployeesManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"team" | "activity">("team");
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // null = closed, "" = creating, id = editing
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<Employee | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load employees");
      setEmployees(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Load the rolling activity log the first time the tab is opened.
  useEffect(() => {
    if (tab !== "activity") return;
    setActivityLoading(true);
    fetch("/api/activity")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setActivity(d))
      .catch(() => {})
      .finally(() => setActivityLoading(false));
  }, [tab]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setForm(emptyForm);
    setEditing("");
    setError(null);
  }

  function openEdit(e: Employee) {
    setForm({
      name: e.name,
      email: e.email,
      phone: e.phone ?? "",
      photoUrl: e.photoUrl ?? "",
      role: e.role,
      status: e.status,
      allowMultipleDevices: e.allowMultipleDevices !== false,
      sendInvite: false,
    });
    setEditing(e._id);
    setError(null);
  }

  async function handleUpload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      set("photoUrl", body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isNew = editing === "";
      const res = await fetch(isNew ? "/api/employees" : `/api/employees/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function patch(employee: Employee, patchBody: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employee._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function setStatus(employee: Employee, status: EmployeeStatus) {
    const verb = status === "suspended" ? "Suspend" : status === "inactive" ? "Deactivate" : "Activate";
    if (status !== "active") {
      const ok = await confirmDialog(
        `${verb} ${employee.name}? They will be signed out of every device immediately and cannot sign in until reactivated.`,
        { confirmLabel: verb }
      );
      if (!ok) return;
    }
    await patch(employee, { status });
  }

  async function handleDelete(employee: Employee) {
    const ok = await confirmDialog(
      `Delete ${employee.name}? Their access is revoked immediately and all active sessions end. This cannot be undone.`
    );
    if (!ok) return;
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employee._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      setEmployees((list) => list.filter((x) => x._id !== employee._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Team
          </p>
          <h1 className="mt-1 text-3xl font-bold">Employees</h1>
          <p className="mt-1 text-sm text-muted">
            {employees.length} employee{employees.length === 1 ? "" : "s"} · only the
            Founder &amp; CEO can manage this list
          </p>
        </div>
        {tab === "team" && (
          <button
            type="button"
            onClick={openNew}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em]"
          >
            <PlusIcon className="h-4 w-4" /> New Employee
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {([
          ["team", "Team"],
          ["activity", "Activity Log"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`cursor-pointer rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors duration-200 ${
              tab === key
                ? "bg-foreground text-background"
                : "border border-line bg-surface text-muted hover:border-gold hover:text-gold"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
          {error}
        </p>
      )}

      {tab === "activity" ? (
        activityLoading ? (
          <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface" />
        ) : activity.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-line p-12 text-center text-muted">
            <p className="font-semibold">No activity recorded yet.</p>
            <p className="mt-1 text-sm">
              Actions appear here as your team works. Entries are kept for 7 days,
              then removed automatically.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-6 text-xs text-muted">
              Showing the last {activity.length} actions · entries older than 7 days are
              deleted automatically.
            </p>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Module</th>
                    <th className="px-4 py-3 font-semibold">Date &amp; Time</th>
                    <th className="px-4 py-3 font-semibold">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a._id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{a.employeeName || "—"}</p>
                        <p className="text-xs text-muted">
                          {ROLE_LABELS[a.employeeRole] ?? a.employeeRole}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{a.employeeName || "Someone"}</span>{" "}
                        <span className="text-muted">{a.action}</span>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted">
                        {(a.module || "—").replace("-", " ")}
                      </td>
                      <td className="px-4 py-3 text-muted">{fmtDateTime(a.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted">{a.ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : loading ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface" />
      ) : employees.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-line p-12 text-center text-muted">
          <p className="font-semibold">No employees yet.</p>
          <p className="mt-1 text-sm">
            Add your first employee — they can then register with their email address.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Position</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last Login</th>
                <th className="px-4 py-3 font-semibold">Date Added</th>
                <th className="px-4 py-3 font-semibold">Devices</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e._id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {e.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-gold">
                          {e.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <p className="font-semibold">{e.name}</p>
                        <p className="text-xs text-muted">
                          {e.registeredAt ? "Registered" : "Not registered yet"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-muted">{e.email}</p>
                    {e.phone && <p className="text-xs text-muted">{e.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-brand/12 px-2.5 py-0.5 text-xs font-semibold text-gold">
                      {ROLE_LABELS[e.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_META[e.status].cls}`}>
                      {STATUS_META[e.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDateTime(e.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-muted">{fmtDate(e.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => patch(e, { allowMultipleDevices: e.allowMultipleDevices === false })}
                      title={
                        e.allowMultipleDevices === false
                          ? "Only one device — signing in elsewhere ends the previous session"
                          : "May stay signed in on multiple devices"
                      }
                      className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 ${
                        e.allowMultipleDevices === false
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-emerald-500/15 text-emerald-500"
                      }`}
                    >
                      {e.allowMultipleDevices === false ? "Single device" : "Multiple"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewing(e)}
                        aria-label={`View ${e.name}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-gold"
                      >
                        <EyeIcon className="h-4.5 w-4.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        aria-label={`Edit ${e.name}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-gold"
                      >
                        <PencilIcon className="h-4.5 w-4.5" />
                      </button>
                      {e.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => setStatus(e, "suspended")}
                          className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStatus(e, "active")}
                          className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface hover:text-emerald-500"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(e)}
                        aria-label={`Delete ${e.name}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
                      >
                        <TrashIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── View details ─────────────────────────────────────────────── */}
      {viewing && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Employee details"
        >
          <div className="animate-fade-up my-8 w-full max-w-md rounded-3xl border border-line bg-background p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {viewing.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewing.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-lg font-bold text-gold">
                    {viewing.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div>
                  <h2 className="text-xl font-bold">{viewing.name}</h2>
                  <p className="text-sm text-muted">{ROLE_LABELS[viewing.role]}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              {[
                ["Email", viewing.email],
                ["Phone", viewing.phone || "—"],
                ["Status", STATUS_META[viewing.status].label],
                ["Access", ROLE_DESCRIPTIONS[viewing.role]],
                ["Devices", viewing.allowMultipleDevices === false ? "Single device only" : "Multiple devices"],
                ["Last login", fmtDateTime(viewing.lastLoginAt)],
                ["Registered", viewing.registeredAt ? fmtDate(viewing.registeredAt) : "Not yet"],
                ["Date added", fmtDate(viewing.createdAt)],
                ["Added by", viewing.createdBy || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-28 shrink-0 font-semibold">{label}</dt>
                  <dd className="text-muted">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmDialog(
                    `Sign ${viewing.name} out of all devices?`,
                    { confirmLabel: "Sign out", danger: true }
                  );
                  if (ok) {
                    await patch(viewing, { revokeSessions: true });
                    setViewing(null);
                  }
                }}
                className="cursor-pointer rounded-full border border-line px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold"
              >
                Sign out all devices
              </button>
              <button
                type="button"
                onClick={() => {
                  openEdit(viewing);
                  setViewing(null);
                }}
                className="cursor-pointer rounded-full bg-gold-bright px-6 py-2.5 text-sm font-bold uppercase tracking-[0.1em]"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / edit ────────────────────────────────────────────── */}
      {editing !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={editing === "" ? "New employee" : "Edit employee"}
        >
          <form
            onSubmit={handleSave}
            className="animate-fade-up my-8 w-full max-w-lg rounded-3xl border border-line bg-background p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editing === "" ? "New Employee" : "Edit Employee"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3">
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.photoUrl} alt="" className="h-16 w-16 rounded-full border border-line object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-line text-muted">
                  <UploadIcon className="h-5 w-5" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold">
                  {uploading ? "Uploading…" : form.photoUrl ? "Replace photo" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handleUpload(e.currentTarget)}
                  />
                </label>
                <span className="text-xs text-muted">Profile photo (optional)</span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="emp-name" className="text-sm font-semibold">Full name</label>
                <input
                  id="emp-name"
                  required
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="emp-email" className="text-sm font-semibold">
                  Email address{" "}
                  <span className="font-normal text-muted">(used to register &amp; sign in)</span>
                </label>
                <input
                  id="emp-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="emp-phone" className="text-sm font-semibold">
                  Phone <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="emp-phone"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="252 ......"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="emp-status" className="text-sm font-semibold">Status</label>
                <select
                  id="emp-status"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as EmployeeStatus)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="emp-role" className="text-sm font-semibold">Position</label>
                <select
                  id="emp-role"
                  value={form.role}
                  onChange={(e) => set("role", e.target.value as Role)}
                  className={`${inputClass} cursor-pointer`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted">{ROLE_DESCRIPTIONS[form.role]}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.allowMultipleDevices}
                  onChange={(e) => set("allowMultipleDevices", e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-current"
                />
                <span>
                  Allow multiple devices
                  <span className="block font-normal text-muted">
                    Off = only one active session; signing in elsewhere ends the previous one.
                  </span>
                </span>
              </label>
              {editing === "" && (
                <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.sendInvite}
                    onChange={(e) => set("sendInvite", e.target.checked)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-current"
                  />
                  <span>
                    Send invitation email
                    <span className="block font-normal text-muted">
                      Emails a registration link. Either way they can register themselves
                      at the login page with this address.
                    </span>
                  </span>
                </label>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="cursor-pointer rounded-full border border-line px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="cursor-pointer rounded-full bg-gold-bright px-6 py-2.5 text-sm font-bold uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : editing === "" ? "Add Employee" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
