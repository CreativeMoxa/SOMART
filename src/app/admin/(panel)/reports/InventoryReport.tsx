"use client";

import { useEffect, useMemo, useState } from "react";
import { computeProfit } from "@/lib/profit";
import { MOVEMENT_LABELS, type MovementType } from "@/lib/inventoryMovement";
import { FREIGHT_META } from "@/lib/freight";
import { ExportButtons } from "@/components/admin/TableTools";

type Product = {
  _id: string;
  name: string;
  category: string;
  price: number;
  costPrice?: number;
  stockQty?: number;
  minStock?: number;
  soldCount?: number;
};
type Movement = {
  _id: string;
  productName: string;
  type: MovementType;
  qtyChange: number;
  reference: string;
  createdAt: string;
};
type Shipment = {
  _id: string;
  number: string;
  freightType: "air" | "sea";
  name: string;
  status: string;
  totalQty: number;
  totalCost: number;
  expectedArrival: string;
  createdAt: string;
};

type SubReport =
  | "current-stock"
  | "low-stock"
  | "out-of-stock"
  | "fast-moving"
  | "slow-moving"
  | "dead-stock"
  | "stock-movement"
  | "air-freight"
  | "sea-freight";

const SUB_REPORTS: { key: SubReport; label: string }[] = [
  { key: "current-stock", label: "Current Stock" },
  { key: "low-stock", label: "Low Stock" },
  { key: "out-of-stock", label: "Out of Stock" },
  { key: "fast-moving", label: "Fast Moving" },
  { key: "slow-moving", label: "Slow Moving" },
  { key: "dead-stock", label: "Dead Stock" },
  { key: "stock-movement", label: "Stock Movement" },
  { key: "air-freight", label: "Air Freight" },
  { key: "sea-freight", label: "Sea Freight" },
];

const GRANULARITIES = ["day", "week", "month", "year"] as const;
type Granularity = (typeof GRANULARITIES)[number];

function money(n: number) {
  return `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function bucketKey(d: Date, g: Granularity) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (g === "year") return `${y}`;
  if (g === "month") return `${y}-${m}`;
  if (g === "week") {
    const onejan = new Date(y, 0, 1);
    const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    return `${y}-W${week}`;
  }
  return `${y}-${m}-${day}`;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

export default function InventoryReport({ companyName }: { companyName: string }) {
  const [sub, setSub] = useState<SubReport>("current-stock");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, m, s] = await Promise.all([
          fetch("/api/products").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/inventory/movements?limit=2000").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/shipments").then((r) => (r.ok ? r.json() : [])),
        ]);
        setProducts(p);
        setMovements(m);
        setShipments(s);
      } catch {
        setError("Failed to load inventory report data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const report = useMemo(() => {
    const withProfit = (p: Product) => {
      const stock = p.stockQty ?? 0;
      const { profitAmount, marginPercent } = computeProfit(p.price, p.costPrice ?? 0);
      return {
        Product: p.name,
        Category: p.category,
        Stock: stock,
        "Min Stock": p.minStock ?? 5,
        Sold: p.soldCount ?? 0,
        Cost: money(p.costPrice ?? 0),
        Sell: money(p.price),
        "Inv. Value": money((p.costPrice || p.price) * stock),
        "Exp. Profit": money(profitAmount * stock),
        "Margin %": marginPercent,
      };
    };

    if (sub === "stock-movement") {
      const buckets = new Map<string, { in: number; out: number }>();
      for (const m of movements) {
        const key = bucketKey(new Date(m.createdAt), granularity);
        const e = buckets.get(key) ?? { in: 0, out: 0 };
        if (m.qtyChange >= 0) e.in += m.qtyChange;
        else e.out += Math.abs(m.qtyChange);
        buckets.set(key, e);
      }
      const rows = [...buckets.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([Period, v]) => ({ Period, "Stock In": v.in, "Stock Out": v.out, Net: v.in - v.out }));
      const totalIn = rows.reduce((s, r) => s + Number(r["Stock In"]), 0);
      const totalOut = rows.reduce((s, r) => s + Number(r["Stock Out"]), 0);
      return {
        kpis: [
          ["Movements", String(movements.length)],
          ["Total In", String(totalIn)],
          ["Total Out", String(totalOut)],
        ] as [string, string][],
        columns: ["Period", "Stock In", "Stock Out", "Net"],
        rows,
      };
    }

    if (sub === "air-freight" || sub === "sea-freight") {
      const type = sub === "air-freight" ? "air" : "sea";
      const list = shipments.filter((s) => s.freightType === type);
      const inTransit = list.filter((s) => s.status !== "received");
      return {
        kpis: [
          ["Shipments", String(list.length)],
          ["In Transit", String(inTransit.length)],
          ["Received", String(list.filter((s) => s.status === "received").length)],
          ["Total Cost", money(list.reduce((s, x) => s + (x.totalCost ?? 0), 0))],
        ] as [string, string][],
        columns: ["Number", "Name", "Status", "Qty", "Cost", "Expected"],
        rows: list.map((s) => ({
          Number: s.number,
          Name: s.name || "—",
          Status: s.status,
          Qty: s.totalQty,
          Cost: money(s.totalCost),
          Expected: s.expectedArrival || "—",
        })),
      };
    }

    // product-based reports
    let list = [...products];
    if (sub === "low-stock") list = list.filter((p) => (p.stockQty ?? 0) > 0 && (p.stockQty ?? 0) <= (p.minStock ?? 5));
    else if (sub === "out-of-stock") list = list.filter((p) => (p.stockQty ?? 0) === 0);
    else if (sub === "dead-stock") list = list.filter((p) => (p.soldCount ?? 0) === 0 && (p.stockQty ?? 0) > 0);
    else if (sub === "fast-moving") list = list.filter((p) => (p.soldCount ?? 0) > 0).sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0));
    else if (sub === "slow-moving") list = list.filter((p) => (p.soldCount ?? 0) > 0).sort((a, b) => (a.soldCount ?? 0) - (b.soldCount ?? 0));

    const totalStock = list.reduce((s, p) => s + (p.stockQty ?? 0), 0);
    const invValue = list.reduce((s, p) => s + (p.costPrice || p.price) * (p.stockQty ?? 0), 0);
    const expProfit = list.reduce((s, p) => s + (p.price - (p.costPrice ?? 0)) * (p.stockQty ?? 0), 0);
    return {
      kpis: [
        ["Products", String(list.length)],
        ["Total Stock", String(totalStock)],
        ["Inventory Value", money(invValue)],
        ["Expected Profit", money(expProfit)],
      ] as [string, string][],
      columns: ["Product", "Category", "Stock", "Min Stock", "Sold", "Cost", "Sell", "Inv. Value", "Exp. Profit", "Margin %"],
      rows: list.map(withProfit),
    };
  }, [sub, granularity, products, movements, shipments]);

  const subLabel = SUB_REPORTS.find((s) => s.key === sub)?.label ?? "";

  async function handleExcel() {
    setBusy(true);
    try {
      const { exportExcel } = await import("@/lib/export");
      exportExcel(`inventory-${sub}`, report.rows as Record<string, unknown>[]);
    } finally {
      setBusy(false);
    }
  }
  async function handlePdf() {
    setBusy(true);
    try {
      const { exportPdf } = await import("@/lib/export");
      await exportPdf({
        filename: `inventory-${sub}`,
        title: `${subLabel} Report`,
        subtitle: sub === "stock-movement" ? `By ${granularity}` : undefined,
        business: { companyName },
        landscape: report.columns.length > 5,
        kpis: report.kpis,
        columns: report.columns.map((c) => ({
          header: c,
          key: c,
          align: /stock|cost|sell|value|profit|qty|sold|net|%|in$|out$/i.test(c) ? ("right" as const) : undefined,
        })),
        rows: report.rows as Record<string, unknown>[],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SUB_REPORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSub(s.key)}
              className={`cursor-pointer rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
                sub === s.key ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ExportButtons onExcel={handleExcel} onPdf={handlePdf} busy={busy || loading} />
      </div>

      {sub === "stock-movement" && (
        <div className="mt-4 flex gap-1.5">
          {GRANULARITIES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
                granularity === g ? "bg-foreground text-background" : "border border-line text-muted hover:border-gold hover:text-gold"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>
      )}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {report.kpis.map(([label, value], i) => (
              <StatCard key={label} label={label} value={value} accent={i === 2 || label === "Inventory Value"} />
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-10 px-3 py-3 font-semibold">#</th>
                  {report.columns.map((c) => (
                    <th key={c} className="px-4 py-3 font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(report.rows as Record<string, string | number>[]).map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 text-xs text-muted">{i + 1}</td>
                    {report.columns.map((c) => (
                      <td key={c} className="px-4 py-3">{row[c]}</td>
                    ))}
                  </tr>
                ))}
                {report.rows.length === 0 && (
                  <tr>
                    <td colSpan={report.columns.length + 1} className="px-4 py-12 text-center text-muted">
                      No data for this report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
