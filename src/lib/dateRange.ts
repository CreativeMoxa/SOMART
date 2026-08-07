// Shared date-range filtering for admin lists (Sales, Expenses) and the
// dashboard drill-down links. Ranges are computed in local time so "Today"
// matches the user's calendar day.

export const DATE_RANGES = ["today", "week", "month", "lastMonth", "year"] as const;
export type DateRange = (typeof DATE_RANGES)[number] | "";

export const RANGE_LABELS: Record<Exclude<DateRange, "">, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  lastMonth: "Last Month",
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
    case "lastMonth":
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    default:
      return null;
  }
}

// Exclusive upper bound for ranges that are a closed window (e.g. "Last Month"
// stops at the first day of the current month). Open-ended ranges return null.
export function rangeEnd(range: DateRange): Date | null {
  const now = new Date();
  switch (range) {
    case "lastMonth":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return null;
  }
}

export function inRange(date: string | Date, range: DateRange): boolean {
  const start = rangeStart(range);
  const end = rangeEnd(range);
  const d = new Date(date);
  if (start && d < start) return false;
  if (end && d >= end) return false;
  return true;
}

// Filter by an explicit start/end date (YYYY-MM-DD strings from date inputs).
// Either bound may be blank; the end is inclusive through the whole day.
export function inCustomRange(
  date: string | Date,
  start: string,
  end: string
): boolean {
  const d = new Date(date);
  if (start) {
    const s = new Date(`${start}T00:00:00`);
    if (!isNaN(s.getTime()) && d < s) return false;
  }
  if (end) {
    const e = new Date(`${end}T23:59:59.999`);
    if (!isNaN(e.getTime()) && d > e) return false;
  }
  return true;
}
