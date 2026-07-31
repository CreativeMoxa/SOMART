"use client";

import { useEffect } from "react";

// Catches a transient failure while a module renders (e.g. a brief database
// blip) and offers a one-tap retry, instead of leaving the visitor on a broken
// or unreachable page.
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin panel render error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-line bg-surface p-10 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-400">
        Hmm, that didn&apos;t load
      </p>
      <h1 className="mt-2 text-2xl font-bold">This page had a hiccup</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The connection dropped for a moment. This is usually temporary — tap
        below to load it again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-block cursor-pointer rounded-full bg-gold-bright px-6 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-opacity duration-200 hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
