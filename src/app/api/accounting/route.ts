import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/auth";
import { startOfWeek } from "@/lib/dateRange";
import { loadAccountingData, summarize, balanceAsOf, dayKey } from "@/lib/accounting";

// GET /api/accounting?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns the summary for the selected window plus the overview figures
// (today / this week / this month / this year / current balance).
export async function GET(req: NextRequest) {
  if (!(await requireModule("accounts"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await loadAccountingData();
    const now = new Date();
    const todayK = dayKey(now);
    const weekStartK = dayKey(startOfWeek(now));
    const weekEndK = dayKey(new Date(startOfWeek(now).getTime() + 6 * 86400000));
    const monthStartK = dayKey(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEndK = dayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const yearStartK = dayKey(new Date(now.getFullYear(), 0, 1));
    const yearEndK = dayKey(new Date(now.getFullYear(), 11, 31));

    const start = req.nextUrl.searchParams.get("start") || todayK;
    const end = req.nextUrl.searchParams.get("end") || start;

    return NextResponse.json({
      period: summarize(data, start, end),
      overview: {
        today: summarize(data, todayK, todayK),
        week: summarize(data, weekStartK, weekEndK),
        month: summarize(data, monthStartK, monthEndK),
        year: summarize(data, yearStartK, yearEndK),
        // Current balance = opening + net of everything up to and including today.
        currentBalance: balanceAsOf(data, dayKey(new Date(now.getTime() + 86400000))),
        openDate: data.openDate,
        opening: data.opening,
      },
    });
  } catch (err) {
    console.error("GET /api/accounting failed:", err);
    return NextResponse.json({ error: "Failed to load accounting" }, { status: 500 });
  }
}
