"use client";

import { useEffect } from "react";

export default function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    // Give the logo/fonts a moment to load before opening the print dialog.
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [auto]);

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
