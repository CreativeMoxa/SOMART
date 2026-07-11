"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ShipmentLite = {
  _id: string;
  number: string;
  name: string;
  freightType: "air" | "sea";
  expectedArrival?: string;
};
type ProductLite = { _id: string; name: string; slug: string; stockQty?: number };

type Data = {
  counts: {
    arrivingSoon: number;
    delayed: number;
    recentlyReceived: number;
    lowStock: number;
    outOfStock: number;
    total: number;
  };
  arrivingSoon: ShipmentLite[];
  delayed: ShipmentLite[];
  recentlyReceived: ShipmentLite[];
  lowStock: ProductLite[];
  outOfStock: ProductLite[];
};

function freightPath(t: "air" | "sea") {
  return t === "sea" ? "/admin/sea-freight" : "/admin/air-freight";
}

export default function NotificationsBell() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  const count = data?.counts.total ?? 0;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>🔔</span> Notifications
        </span>
        {count > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-line bg-surface p-3 text-xs">
          {!data ? (
            <p className="text-muted">Loading…</p>
          ) : count === 0 && data.counts.recentlyReceived === 0 ? (
            <p className="text-muted">You&apos;re all caught up.</p>
          ) : (
            <>
              <Section title={`Arriving soon (${data.counts.arrivingSoon})`} tone="sky">
                {data.arrivingSoon.map((s) => (
                  <Link key={s._id} href={freightPath(s.freightType)} className="block hover:text-gold">
                    {s.number} — {s.name || "shipment"} · {s.expectedArrival}
                  </Link>
                ))}
              </Section>
              <Section title={`Delayed (${data.counts.delayed})`} tone="red">
                {data.delayed.map((s) => (
                  <Link key={s._id} href={freightPath(s.freightType)} className="block hover:text-gold">
                    {s.number} — {s.name || "shipment"} · was due {s.expectedArrival}
                  </Link>
                ))}
              </Section>
              <Section title={`Out of stock (${data.counts.outOfStock})`} tone="red">
                {data.outOfStock.map((p) => (
                  <Link key={p._id} href="/admin/inventory" className="block hover:text-gold">
                    {p.name}
                  </Link>
                ))}
              </Section>
              <Section title={`Low stock (${data.counts.lowStock})`} tone="amber">
                {data.lowStock.map((p) => (
                  <Link key={p._id} href="/admin/inventory" className="block hover:text-gold">
                    {p.name} · {p.stockQty} left
                  </Link>
                ))}
              </Section>
              <Section title={`Recently received (${data.counts.recentlyReceived})`} tone="emerald">
                {data.recentlyReceived.map((s) => (
                  <Link key={s._id} href={freightPath(s.freightType)} className="block hover:text-gold">
                    {s.number} — {s.name || "shipment"}
                  </Link>
                ))}
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "sky" | "red" | "amber" | "emerald";
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  if (arr.filter(Boolean).length === 0) return null;
  const toneCls = {
    sky: "text-sky-500",
    red: "text-red-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
  }[tone];
  return (
    <div>
      <p className={`font-bold uppercase tracking-wider ${toneCls}`}>{title}</p>
      <div className="mt-1 space-y-1 text-muted">{children}</div>
    </div>
  );
}
