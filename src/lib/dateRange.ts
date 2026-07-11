// Shared date-range filtering for admin lists (Sales, Expenses) and the
// dashboard drill-down links. Ranges are computed in local time so "Today"
// matches the user's calendar day.

export const DATE_RANGES = ["today", "week", "month", "year"] as const;
export type DateRange = (typeof DATE_RANGES)[number] | "";

export const RANGE_LABELS: Record<Exclude<DateRange, "">, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

export function normalizeRange(value: string | null | undefined): DateRange {
  return value && (DATE_RANGES as readonly string[]).includes(value)
    ? (value as DateRange)
    : "";
}

export function rangeStart(range: DateRange): Date | null {
  const now = new Date();
  switch (range) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      // Week starts Monday.
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const offset = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - offset);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    default:
      return null;
  }
}

export function inRange(date: string | Date, range: DateRange): boolean {
  const start = rangeStart(range);
  if (!start) return true;
  return new Date(date) >= start;
}
