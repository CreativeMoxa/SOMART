"use client";

import { useState } from "react";
import { ExportButtons } from "@/components/admin/TableTools";

type Row = {
  label: string;
  monthCount: number;
  monthRevenue: number;
  totalCount: number;
  totalRevenue: number;
  totalProfit: number;
  invoiceCount: number;
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default function MarketingExport({
  rows,
  companyName,
}: {
  rows: Row[];
  companyName: string;
}) {
  const [busy, setBusy] = useState(false);

  function exportRows() {
    return rows.map((r) => ({
      "Customer Type": r.label,
      "Sales (This Month)": r.monthCount,
      "Revenue (This Month)": r.monthRevenue,
      "Sales (All Time)": r.totalCount,
      "Revenue (All Time)": r.totalRevenue,
      "Profit (All Time)": r.totalProfit,
      Invoices: r.invoiceCount,
    }));
  }

  async function handleExcel() {
    setBusy(true);
    try {
      const { exportExcel } = await import("@/lib/export");
      exportExcel("marketing", exportRows());
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf() {
    setBusy(true);
    try {
      const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
      const { exportPdf } = await import("@/lib/export");
      await exportPdf({
        filename: "marketing",
        title: "Marketing Report",
        subtitle: "Where customers come from",
        business: { companyName },
        kpis: [
          ["Total revenue", money(totalRevenue)],
          [
            "Top channel",
            [...rows].sort((a, b) => b.totalRevenue - a.totalRevenue)[0]?.label ?? "—",
          ],
        ],
        columns: [
          { header: "Customer type", key: "Customer Type" },
          { header: "Sales (month)", key: "Sales (This Month)", align: "right" },
          { header: "Revenue (month)", key: "MonthRevFmt", align: "right" },
          { header: "Sales (all)", key: "Sales (All Time)", align: "right" },
          { header: "Revenue (all)", key: "AllRevFmt", align: "right" },
          { header: "Profit (all)", key: "ProfitFmt", align: "right" },
          { header: "Invoices", key: "Invoices", align: "right" },
        ],
        rows: exportRows().map((r) => ({
          ...r,
          MonthRevFmt: money(Number(r["Revenue (This Month)"])),
          AllRevFmt: money(Number(r["Revenue (All Time)"])),
          ProfitFmt: money(Number(r["Profit (All Time)"])),
        })),
      });
    } finally {
      setBusy(false);
    }
  }

  return <ExportButtons onExcel={handleExcel} onPdf={handlePdf} busy={busy} />;
}
