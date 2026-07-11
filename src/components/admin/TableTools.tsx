"use client";

import { useState } from "react";

// Shared row-selection state + bulk toolbar + export buttons for admin tables.

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: string[]) {
    setSelected((prev) =>
      ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)
    );
  }

  function clear() {
    setSelected(new Set());
  }

  return { selected, toggle, toggleAll, clear };
}

export const checkboxClass =
  "h-4 w-4 cursor-pointer accent-[var(--gold,#c9a24b)]";

export function BulkBar({
  count,
  onDelete,
  onClear,
  deleting,
}: {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  deleting?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/5 px-4 py-3">
      <span className="text-sm font-semibold">
        {count} row{count === 1 ? "" : "s"} selected
      </span>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="cursor-pointer rounded-full bg-red-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-red-500 transition-colors duration-200 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {deleting ? "Deleting…" : "Delete selected"}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer rounded-full border border-line px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
      >
        Clear selection
      </button>
    </div>
  );
}

export function ExportButtons({
  onExcel,
  onPdf,
  busy,
}: {
  onExcel: () => void;
  onPdf: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onExcel}
        disabled={busy}
        className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-muted transition-colors duration-200 hover:border-emerald-500 hover:text-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        ⬇ Excel
      </button>
      <button
        type="button"
        onClick={onPdf}
        disabled={busy}
        className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-muted transition-colors duration-200 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
      >
        ⬇ PDF
      </button>
    </div>
  );
}
