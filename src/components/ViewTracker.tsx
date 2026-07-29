"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Records one web view per public page the visitor lands on. Skips the admin
// panel and API routes. Uses sendBeacon so the request survives navigation and
// never blocks the page.
export default function ViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const body = JSON.stringify({ path: pathname });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/views", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/views", { method: "POST", body, keepalive: true });
      }
    } catch {
      // Tracking is best-effort — ignore any failure.
    }
  }, [pathname]);

  return null;
}
