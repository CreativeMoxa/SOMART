"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="cursor-pointer rounded-full bg-gold-bright px-6 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
