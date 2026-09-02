import { getSettings } from "@/models/Setting";
import { startOfWeek } from "@/lib/dateRange";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

// PDF 2 — blank A4 Portrait Weekly Daily Cash & Accounting sheet. Week runs
// Saturday → Friday with the correct dates auto-filled; everything else blank
// for handwriting. Printed and filled in daily by staff.

const WEEKDAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const CASH = ["ZAAD $", "SL CASH", "EDAHAB", "EBIRR", "PREMIER WALLET"];

function Blank({ w = "70px" }: { w?: string }) {
  return <span className="inline-block border-b border-black/50" style={{ minWidth: w }}>&nbsp;</span>;
}

export default async function CashSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ auto?: string }>;
}) {
  const { auto } = await searchParams;
  const settings = await getSettings();
  const logo = settings.elementLogoUrl || "/logo-mark-navy.png";
  const company = settings.companyName || "SOMART";

  const sat = startOfWeek(new Date());
  const days = WEEKDAYS.map((name, i) => {
    const d = new Date(sat.getTime() + i * 86400000);
    return { name, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` };
  });
  const weekLabel = `${days[0].date}  →  ${days[6].date}`;

  return (
    <div className="mx-auto max-w-[820px]">
      <style>{`@media print {
        @page { size: A4 portrait; margin: 8mm; }
        body { background:#fff !important; }
        .sheet { box-shadow:none !important; border:none !important; margin:0 !important; padding:0 !important; }
        .print-hide { display:none !important; }
      }
      .sheet { color:#111; }
      .day { border:1px solid #333; }
      `}</style>

      <div className="print-hide mb-4 flex justify-end">
        <PrintButton auto={auto === "1"} />
      </div>

      <div className="sheet rounded-lg border border-black/20 bg-white p-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <div>
              <p className="text-base font-extrabold tracking-wide">{company}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-black/60">Weekly Daily Cash &amp; Accounting</p>
            </div>
          </div>
          <p className="text-[10px] font-semibold">Week: {weekLabel}</p>
        </div>

        {/* 7 day sections */}
        <div className="mt-2 space-y-1.5">
          {days.map((d) => (
            <div key={d.name} className="day px-2 py-1 text-[8.5px] leading-tight">
              <div className="flex items-center justify-between border-b border-black/30 pb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wide">{d.name} — {d.date}</span>
                <span className="flex gap-4 font-semibold">
                  <span>Revenue: <Blank w="55px" /></span>
                  <span>Profit: <Blank w="55px" /></span>
                </span>
              </div>
              <div className="mt-1 grid grid-cols-[1.15fr_1.15fr_0.7fr] gap-2">
                {/* Cash collection */}
                <div>
                  <p className="font-bold uppercase tracking-wide">Cash Collection</p>
                  <div className="mt-0.5 grid grid-cols-2 gap-x-2">
                    {CASH.map((c) => (
                      <p key={c} className="whitespace-nowrap">{c}: <Blank w="34px" /></p>
                    ))}
                    <p className="whitespace-nowrap font-semibold">TOTAL: <Blank w="34px" /></p>
                  </div>
                </div>
                {/* Expense */}
                <div>
                  <p className="font-bold uppercase tracking-wide">Expense</p>
                  <div className="mt-0.5 space-y-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <p key={n} className="whitespace-nowrap">{n}. <Blank w="90px" /> = <Blank w="34px" /></p>
                    ))}
                    <p className="whitespace-nowrap font-semibold">TOTAL EXPENSE: <Blank w="40px" /></p>
                  </div>
                </div>
                {/* Goals */}
                <div>
                  <p className="font-bold uppercase tracking-wide">Goals</p>
                  <div className="mt-0.5 space-y-1">
                    <p className="whitespace-nowrap"><Blank w="26px" /> Orders</p>
                    <p className="whitespace-nowrap"><Blank w="26px" /> Sunglasses</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
