"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Counts one web view per visit, and only when the visitor reaches the home
// page hero. Moving around the site (Shop, product pages, …) never adds to the
// count — the flag below makes each browsing session count at most once.
export default function ViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Only the landing/hero page counts.
    if (pathname !== "/") return;

    // One count per visit: skip if this session already counted.
    let alreadyCounted = false;
    try {
      alreadyCounted = sessionStorage.getItem("somart_hero_counted") === "1";
      if (!alreadyCounted) sessionStorage.setItem("somart_hero_counted", "1");
    } catch {
      // Storage unavailable (e.g. private mode) — fall through and count once.
    }
    if (alreadyCounted) return;

    const body = JSON.stringify({ path: "/" });
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
