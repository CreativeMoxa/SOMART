import { getSettings } from "@/models/Setting";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

// PDF 3 — blank A4 Portrait Monthly Accounting Sheet. Month/year auto-filled to
// the current month; day rows are blank for handwriting. Print → Save as PDF.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const line = "border-b border-black/40 inline-block min-w-[110px]";

function DayTable({ days }: { days: number[] }) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="bg-black/[0.06] text-left">
          <th className="p-1.5">Date</th>
          <th className="p-1.5">Income</th>
          <th className="p-1.5">Expenses</th>
          <th className="p-1.5">Net Balance</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d}>
            <td className="h-7 p-1.5 font-semibold">{d}</td>
            <td className="p-1.5" />
            <td className="p-1.5" />
            <td className="p-1.5" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function MonthlySheetPage({
  searchParams,
}: {
  searchParams: Promise<{ auto?: string }>;
}) {
  const { auto } = await searchParams;
  const settings = await getSettings();
  const logo = settings.elementLogoUrl || "/logo-mark-navy.png";
  const company = settings.companyName || "SOMART";

  const now = new Date();
  const monthName = MONTHS[now.getMonth()];
  const year = now.getFullYear();
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
  const all = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const mid = Math.ceil(daysInMonth / 2);
  const left = all.slice(0, mid);
  const right = all.slice(mid);

  return (
    <div className="mx-auto max-w-[820px]">
      <style>{`@media print {
        @page { size: A4 portrait; margin: 9mm; }
        body { background:#fff !important; }
        .sheet { box-shadow:none !important; border:none !important; margin:0 !important; }
        .print-hide { display:none !important; }
      }
      .sheet { color:#111; }
      .sheet th, .sheet td { border:1px solid #333; }
      `}</style>

      <div className="print-hide mb-4 flex justify-end">
        <PrintButton auto={auto === "1"} />
      </div>

      <div className="sheet rounded-lg border border-black/20 bg-white p-6 text-[11px] leading-relaxed">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" className="h-11 w-11 object-contain" />
            <div>
              <p className="text-lg font-extrabold tracking-wide">{company}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/60">Monthly Accounting Sheet</p>
            </div>
          </div>
          <div className="text-right text-[11px] text-black/70">
            <p>Month: <span className="font-bold text-black">{monthName}</span></p>
            <p className="mt-1.5">Year: <span className="font-bold text-black">{year}</span></p>
            <p className="mt-1.5">Opening Balance: <span className={line} /></p>
          </div>
        </div>

        {/* Two-column daily tables */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <DayTable days={left} />
          <DayTable days={right} />
        </div>

        {/* Monthly totals */}
        <div className="mt-5 grid grid-cols-2 gap-x-10 gap-y-3">
          <p className="col-span-2 text-[11px] font-bold uppercase tracking-[0.15em]">Monthly Totals</p>
          <p>Total Income: <span className={`${line} w-full`} /></p>
          <p>Total Expenses: <span className={`${line} w-full`} /></p>
          <p>Net Balance: <span className={`${line} w-full`} /></p>
          <p>Closing Balance: <span className={`${line} w-full`} /></p>
        </div>

        {/* Notes */}
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em]">Notes / Important Transactions</p>
          <div className="mt-2 space-y-6">
            <div className="border-b border-black/40" />
            <div className="border-b border-black/40" />
            <div className="border-b border-black/40" />
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-7 grid grid-cols-3 gap-6 text-[11px]">
          <p>Prepared By: <br /><br /><span className="block border-b border-black/50" /></p>
          <p>Checked By: <br /><br /><span className="block border-b border-black/50" /></p>
          <p>Date: <br /><br /><span className="block border-b border-black/50" /></p>
        </div>
      </div>
    </div>
  );
}
