"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type DayPoint = { date: string; label: string; dateLabel: string; total: number };

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Daily sales as a horizontally scrollable strip. Native touch scrolling makes
// the finger-swipe smooth on mobile; ~7 days show at once and the rest scroll
// in. Bars are scaled to the all-time best day so the tallest bar anywhere in
// the strip is literally the best day ever — swipe to find it. The arrows page
// a screenful for mouse users.
export default function WeeklySalesChart({ series }: { series: DayPoint[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const best = useMemo(() => {
    let b: DayPoint | null = null;
    for (const d of series) if (!b || d.total > b.total) b = d;
    return b && b.total > 0 ? b : null;
  }, [series]);
  const allMax = Math.max(...series.map((d) => d.total), 1);

  const rangeOf = (first: number, last: number) =>
    series.length ? `${series[first]?.dateLabel} – ${series[last]?.dateLabel}` : "";

  // Default label shows the most recent 7 days (also correct for SSR).
  const [range, setRange] = useState(() =>
    rangeOf(Math.max(0, series.length - 7), Math.max(0, series.length - 1))
  );

  function updateRange() {
    const el = scroller.current;
    if (!el || series.length === 0) return;
    const dayW = el.scrollWidth / series.length;
    const first = Math.max(0, Math.round(el.scrollLeft / dayW));
    const visible = Math.max(1, Math.round(el.clientWidth / dayW));
    const last = Math.min(series.length - 1, first + visible - 1);
    setRange(rangeOf(first, last));
  }

  // Open on the most recent day (scroll to the far right).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    updateRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScroll() {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(updateRange);
  }

  function page(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-muted">{range}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => page(-1)}
            aria-label="Earlier days"
            className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-sm text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            aria-label="Later days"
            className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-sm text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="mt-3 flex items-end gap-3 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          height: 184,
          // Let the browser disambiguate gestures: horizontal swipe scrolls the
          // strip, vertical swipe scrolls the page. overscroll-contain stops a
          // horizontal fling from triggering the browser's back-swipe.
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {series.map((d) => {
          const isBest = best != null && d.date === best.date;
          return (
            <div
              key={d.date}
              className="flex flex-col items-center gap-1.5"
              style={{ flex: "0 0 calc((100% - 72px) / 7)", scrollSnapAlign: "start" }}
            >
              <span className="whitespace-nowrap text-[10px] font-semibold text-muted">
                {d.total > 0 ? money(d.total) : ""}
              </span>
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${
                  isBest ? "bg-gold-bright" : "bg-gold-bright/55"
                }`}
                style={{ height: `${Math.max((d.total / allMax) * 130, d.total > 0 ? 8 : 2)}px` }}
              />
              <span className="text-xs font-semibold text-muted">{d.label}</span>
              <span className="whitespace-nowrap text-[10px] text-muted/80">{d.dateLabel}</span>
            </div>
          );
        })}
      </div>

      {best && (
        <p className="mt-2 text-xs text-muted">
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
