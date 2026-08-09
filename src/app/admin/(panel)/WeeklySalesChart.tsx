"use client";

import { useMemo, useRef, useState } from "react";

export type DayPoint = { date: string; label: string; dateLabel: string; total: number };

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const WINDOW = 7;

// A 7-day bar chart the user can page through (buttons or swipe) across the
// whole sales history, so they can spot which day was best. Each bar shows its
// weekday and the actual date; the tallest day in view is highlighted, and the
// all-time best day is called out beneath the chart.
export default function WeeklySalesChart({ series }: { series: DayPoint[] }) {
  // `end` is the index of the last (right-most) visible day. Default to the
  // most recent day so the chart opens on the current week.
  const [end, setEnd] = useState(Math.max(series.length - 1, 0));
  const touchX = useRef<number | null>(null);

  const minEnd = Math.min(WINDOW - 1, series.length - 1);
  const maxEnd = series.length - 1;

  const view = useMemo(() => {
    const stop = Math.min(Math.max(end, minEnd), maxEnd);
    const start = Math.max(0, stop - (WINDOW - 1));
    return series.slice(start, stop + 1);
  }, [series, end, minEnd, maxEnd]);

  const best = useMemo(() => {
    let b: DayPoint | null = null;
    for (const d of series) if (!b || d.total > b.total) b = d;
    return b && b.total > 0 ? b : null;
  }, [series]);

  const viewMax = Math.max(...view.map((d) => d.total), 1);
  const canOlder = end - WINDOW >= 0 && end > minEnd;
  const canNewer = end < maxEnd;

  function older() {
    setEnd((e) => Math.max(minEnd, e - WINDOW));
  }
  function newer() {
    setEnd((e) => Math.min(maxEnd, e + WINDOW));
  }

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 40) return;
    // Swipe right → older (go back in time); swipe left → newer.
    if (dx > 0) older();
    else newer();
  }

  const rangeLabel =
    view.length > 0 ? `${view[0].dateLabel} – ${view[view.length - 1].dateLabel}` : "";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-muted">{rangeLabel}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={older}
            disabled={!canOlder}
            aria-label="Earlier week"
            className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-sm text-muted transition-colors duration-200 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            onClick={newer}
            disabled={!canNewer}
            aria-label="Later week"
            className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-sm text-muted transition-colors duration-200 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>

      <div
        className="mt-3 flex h-44 items-end gap-3 touch-pan-y select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {view.map((d) => {
          const isBestInView = d.total > 0 && d.total === viewMax;
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted">
                {d.total > 0 ? money(d.total) : ""}
              </span>
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${
                  isBestInView ? "bg-gold-bright" : "bg-gold-bright/60"
                }`}
                style={{ height: `${Math.max((d.total / viewMax) * 130, d.total > 0 ? 8 : 2)}px` }}
              />
              <span className="text-xs font-semibold text-muted">{d.label}</span>
              <span className="text-[10px] text-muted/80">{d.dateLabel}</span>
            </div>
          );
        })}
      </div>

      {best && (
        <p className="mt-3 text-xs text-muted">
          Best day all-time:{" "}
          <span className="font-semibold text-gold">
            {best.label}, {best.dateLabel}
          </span>{" "}
          — {money(best.total)}
        </p>
      )}
    </div>
  );
}
