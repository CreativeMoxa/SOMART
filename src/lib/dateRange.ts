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

// Weeks run Saturday → Friday: the start is the most recent Saturday (today if
// it is Saturday). Shared by the Sales/Expenses "This Week" filter, the
// dashboard's Weekly Orders and inventory's Sold This Week so they all agree.
export function startOfWeek(ref: Date = new Date()): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  // getDay(): Sun=0 … Sat=6. Days since the last Saturday = (day + 1) % 7.
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return d;
}

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
    case "week":
      return startOfWeek(now);
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
