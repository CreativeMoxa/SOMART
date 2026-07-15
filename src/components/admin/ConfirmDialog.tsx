"use client";

import { useEffect, useState } from "react";

// A promise-based confirmation dialog that works reliably on mobile.
// Native window.confirm() is suppressed by many mobile in-app browsers and by
// home-screen (standalone/PWA) mode, which made deletes silently do nothing.
// Call confirmDialog(...) anywhere; <ConfirmHost /> (mounted once in the admin
// layout) renders the actual modal.

type Options = { confirmLabel?: string; danger?: boolean };
type Request = { message: string; options: Options; resolve: (ok: boolean) => void };

let pushRequest: ((req: Request) => void) | null = null;

export function confirmDialog(message: string, options: Options = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (pushRequest) {
      pushRequest({ message, options, resolve });
    } else if (typeof window !== "undefined") {
      // Fallback if the host isn't mounted yet.
      resolve(window.confirm(message));
    } else {
      resolve(false);
    }
  });
}

export default function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);

  useEffect(() => {
    pushRequest = (r) => setReq(r);
    return () => {
      pushRequest = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  function close(ok: boolean) {
    req?.resolve(ok);
    setReq(null);
  }

  if (!req) return null;

  const danger = req.options.danger ?? true;
  const label = req.options.confirmLabel ?? "Delete";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm"
      onClick={() => close(false)}
    >
      <div
        className="animate-fade-up w-full max-w-sm rounded-3xl border border-line bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm leading-relaxed text-foreground">{req.message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="cursor-pointer rounded-full border border-line px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-bold text-white transition-transform duration-200 hover:scale-[1.02] ${
              danger ? "bg-red-500 hover:bg-red-600" : "bg-gold-bright"
            }`}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
