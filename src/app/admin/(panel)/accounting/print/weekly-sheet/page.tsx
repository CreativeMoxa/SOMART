import { getSettings } from "@/models/Setting";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

// PDF 1 — blank A4 Portrait Weekly Accounting Sheet (print → Save as PDF).
// Deliberately blank: printed and filled in by hand.

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const line = "border-b border-black/40 min-w-[120px] inline-block";

export default async function WeeklySheetPage({
  searchParams,
}: {
  searchParams: Promise<{ auto?: string }>;
}) {
  const { auto } = await searchParams;
  const settings = await getSettings();
  const logo = settings.elementLogoUrl || "/logo-mark-navy.png";
  const company = settings.companyName || "SOMART";

  return (
    <div className="mx-auto max-w-[820px]">
      <style>{`@media print {
        @page { size: A4 portrait; margin: 10mm; }
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

      <div className="sheet rounded-lg border border-black/20 bg-white p-8 text-[12px] leading-relaxed">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-lg font-extrabold tracking-wide">{company}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/60">Weekly Accounting Sheet</p>
            </div>
          </div>
          <div className="text-right text-[11px] text-black/70">
            <p>Week Starting: <span className={line} /></p>
            <p className="mt-2">Week Ending: <span className={line} /></p>
            <p className="mt-2">Opening Balance: <span className={line} /></p>
          </div>
        </div>

        {/* Daily table */}
        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-black/[0.06] text-left">
              <th className="p-2">Day</th>
              <th className="p-2">Date</th>
              <th className="p-2">Income / Sales</th>
              <th className="p-2">Expenses</th>
              <th className="p-2">Other Income</th>
              <th className="p-2">Other Expenses</th>
              <th className="p-2">Net Balance</th>
              <th className="p-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d}>
                <td className="p-2 font-semibold">{d}</td>
                <td className="h-11 p-2" />
                <td className="p-2" />
                <td className="p-2" />
                <td className="p-2" />
                <td className="p-2" />
                <td className="p-2" />
                <td className="p-2" />
              </tr>
            ))}
          </tbody>
        </table>

        {/* Weekly totals */}
        <div className="mt-5 grid grid-cols-2 gap-x-10 gap-y-3">
          <p className="col-span-2 text-[11px] font-bold uppercase tracking-[0.15em]">Weekly Totals</p>
          <p>Total Income: <span className={`${line} w-full`} /></p>
          <p>Total Expenses: <span className={`${line} w-full`} /></p>
          <p>Other Income: <span className={`${line} w-full`} /></p>
          <p>Other Expenses: <span className={`${line} w-full`} /></p>
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
            <div className="border-b border-black/40" />
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-3 gap-6 text-[11px]">
          <p>Prepared By: <br /><br /><span className="block border-b border-black/50" /></p>
          <p>Checked By: <br /><br /><span className="block border-b border-black/50" /></p>
          <p>Date: <br /><br /><span className="block border-b border-black/50" /></p>
        </div>
      </div>
    </div>
  );
}
