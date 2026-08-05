"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { INK, MUTED, loadImageData } from "@/lib/pdfChrome";
import { savePdf, type PdfBusiness } from "@/lib/export";
import type { BIBar, BIInsight, BIKpi, BIReport, BITable } from "./types";

const LAV: [number, number, number] = [238, 240, 252];
const LAV2: [number, number, number] = [235, 233, 251];

type State = { pdf: jsPDF; y: number; W: number; H: number; M: number; page: number };

export async function exportBIReportPdf(report: BIReport, business: PdfBusiness & { elementLogoUrl?: string }) {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 42;
  const s: State = { pdf, y: 0, W, H, M, page: 0 };

  const logo = await loadImageData(business.elementLogoUrl || "/logo-mark-navy.png");

  // ── Cover page ──────────────────────────────────────────────────────────────
  pdf.setFillColor(...LAV2);
  pdf.rect(0, 0, W, 220, "F");
  if (logo) pdf.addImage(logo.dataUrl, "PNG", W / 2 - 34, 70, 68, 68);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...INK);
  pdf.setFontSize(13);
  pdf.text((report.meta.company || "SOMART").toUpperCase(), W / 2, 168, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text(business.tagline || "", W / 2, 184, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...INK);
  pdf.setFontSize(30);
  pdf.text("Business Intelligence", W / 2, 330, { align: "center" });
  pdf.text("Report", W / 2, 366, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(...MUTED);
  pdf.text(`Reporting period:  ${report.meta.periodLabel}`, W / 2, 410, { align: "center" });
  pdf.text(`Generated:  ${new Date(report.meta.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, W / 2, 430, { align: "center" });

  // Health badge
  const bx = W / 2 - 70, by = 480, bw = 140, bh = 96;
  pdf.setFillColor(...INK);
  pdf.roundedRect(bx, by, bw, bh, 12, 12, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.text("BUSINESS HEALTH", W / 2, by + 22, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(34);
  pdf.text(`${report.health.score}`, W / 2, by + 60, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(report.health.grade, W / 2, by + 82, { align: "center" });

  pdf.setTextColor(...MUTED);
  pdf.setFontSize(9);
  pdf.text("Confidential — for management use. Every figure is computed from live business records.", W / 2, H - 50, { align: "center" });

  // ── Content pages ────────────────────────────────────────────────────────────
  newPage(s, report);

  execSummary(s, report);
  insightSection(s, "Key Business Insights", report.keyInsights);
  kpiSection(s, "Sales Analysis", report.sales.kpis, report.sales.narrative);
  barBlock(s, "Revenue by day", report.sales.byDay);
  barBlock(s, "Revenue by payment method", report.sales.byPayment);

  kpiSection(s, "Customer Analysis", report.customers.kpis, report.customers.narrative);
  tableBlock(s, "Top customers", report.customers.top);
  barBlock(s, "Revenue by customer type", report.customers.byType);
  barBlock(s, "Top cities by revenue", report.customers.byCity);

  heading(s, "Product Analysis");
  tableBlock(s, "Top products by revenue", report.products.topByRevenue);
  barBlock(s, "Category performance", report.products.categories);
  barBlock(s, "Brand performance", report.products.brands);
  if (report.products.basket.length) {
    bulletBlock(s, "Frequently bought together", report.products.basket.map((b) => `${b.pair} — ${b.count} orders`));
  }
  tableBlock(s, "Fast movers", report.products.fastMovers);
  tableBlock(s, "Slow movers", report.products.slowMovers);
  narrative(s, report.products.narrative);

  heading(s, `Best Shopping Time — peaks in the ${report.shopTime.peakShift}`);
  barBlock(s, "Orders by hour (local time)", report.shopTime.byHour.filter((h) => h.value > 0));
  barBlock(s, "Orders by weekday", report.shopTime.byWeekday);
  narrative(s, report.shopTime.narrative);

  heading(s, "Marketing Performance");
  tableBlock(s, "", report.marketing.byChannel);
  narrative(s, report.marketing.narrative);

  kpiSection(s, "Inventory Analysis", report.inventory.kpis, report.inventory.narrative);
  tableBlock(s, "Restock priorities", report.inventory.restock);

  kpiSection(s, "Freight & Logistics", report.freight.kpis, report.freight.narrative);
  tableBlock(s, "Air vs Sea", report.freight.byType);
  tableBlock(s, "Forwarders / suppliers", report.freight.forwarders);

  kpiSection(s, "Financial Performance", report.financial.kpis, report.financial.narrative);
  barBlock(s, "Expenses by category", report.financial.expensesByCategory);

  kpiSection(s, "Trend Analysis", report.trends.kpis, report.trends.narrative);

  insightSection(s, "Opportunities", report.opportunities);
  insightSection(s, "Risks", report.risks);

  if (report.forecast) kpiSection(s, "Forecasts & Predictions", report.forecast.kpis, report.forecast.narrative);

  heading(s, "Actionable Recommendations");
  recBlock(s, report.recommendations);

  // Footers with page numbers on content pages (2..end).
  const total = pdf.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(220, 220, 230);
    pdf.line(M, H - 34, W - M, H - 34);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(`${report.meta.company} · Business Intelligence Report`, M, H - 22);
    pdf.text(`Page ${p - 1} / ${total - 1}`, W - M, H - 22, { align: "right" });
  }

  savePdf(pdf, `BI-report_${report.meta.from || "all"}_${report.meta.to || "now"}.pdf`);
}

// ── Layout helpers ────────────────────────────────────────────────────────────
function newPage(s: State, report: BIReport) {
  s.pdf.addPage();
  s.page += 1;
  // Header band
  s.pdf.setFillColor(...INK);
  s.pdf.rect(0, 0, s.W, 4, "F");
  s.pdf.setFont("helvetica", "bold");
  s.pdf.setFontSize(9);
  s.pdf.setTextColor(...INK);
  s.pdf.text((report.meta.company || "SOMART").toUpperCase(), s.M, 26);
  s.pdf.setFont("helvetica", "normal");
  s.pdf.setTextColor(...MUTED);
  s.pdf.text(report.meta.periodLabel, s.W - s.M, 26, { align: "right" });
  s.y = 52;
}
function ensure(s: State, need: number, report: BIReport) {
  if (s.y + need > s.H - 48) newPage(s, report);
}
let CURRENT_REPORT: BIReport | null = null;
function R(): BIReport { return CURRENT_REPORT!; }

function heading(s: State, title: string) {
  ensure(s, 40, R());
  s.pdf.setFillColor(...LAV);
  s.pdf.roundedRect(s.M, s.y, s.W - s.M * 2, 24, 5, 5, "F");
  s.pdf.setFont("helvetica", "bold");
  s.pdf.setFontSize(12);
  s.pdf.setTextColor(...INK);
  s.pdf.text(title, s.M + 10, s.y + 16);
  s.y += 34;
}
function narrative(s: State, lines: string[]) {
  if (!lines.length) return;
  s.pdf.setFont("helvetica", "normal");
  s.pdf.setFontSize(9.5);
  s.pdf.setTextColor(70, 78, 96);
  for (const line of lines) {
    const wrapped = s.pdf.splitTextToSize(`•  ${line}`, s.W - s.M * 2 - 4);
    ensure(s, wrapped.length * 12 + 4, R());
    s.pdf.text(wrapped, s.M + 2, s.y + 9);
    s.y += wrapped.length * 12 + 4;
  }
  s.y += 4;
}
function kpiGrid(s: State, kpis: BIKpi[]) {
  const cols = 3;
  const gap = 8;
  const cw = (s.W - s.M * 2 - gap * (cols - 1)) / cols;
  const ch = 46;
  for (let i = 0; i < kpis.length; i++) {
    const col = i % cols;
    if (col === 0) ensure(s, ch + gap, R());
    const x = s.M + col * (cw + gap);
    if (col === 0 && i > 0) s.y += 0;
    s.pdf.setFillColor(248, 249, 253);
    s.pdf.roundedRect(x, s.y, cw, ch, 6, 6, "F");
    s.pdf.setFont("helvetica", "normal");
    s.pdf.setFontSize(7);
    s.pdf.setTextColor(...MUTED);
    s.pdf.text(kpis[i].label.toUpperCase(), x + 8, s.y + 14);
    s.pdf.setFont("helvetica", "bold");
    s.pdf.setFontSize(13);
    s.pdf.setTextColor(...INK);
    s.pdf.text(String(kpis[i].value), x + 8, s.y + 32);
    if (kpis[i].hint) {
      s.pdf.setFont("helvetica", "normal");
      s.pdf.setFontSize(7.5);
      s.pdf.setTextColor(...MUTED);
      s.pdf.text(String(kpis[i].hint), x + 8, s.y + 42);
    }
    if (col === cols - 1 || i === kpis.length - 1) s.y += ch + gap;
  }
}
function kpiSection(s: State, title: string, kpis: BIKpi[], narr: string[]) {
  heading(s, title);
  kpiGrid(s, kpis);
  narrative(s, narr);
}
function barBlock(s: State, title: string, data: BIBar[]) {
  if (!data.length) return;
  ensure(s, 24, R());
  if (title) {
    s.pdf.setFont("helvetica", "bold");
    s.pdf.setFontSize(9.5);
    s.pdf.setTextColor(...INK);
    s.pdf.text(title, s.M, s.y + 8);
    s.y += 16;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = s.W - s.M * 2 - 150;
  for (const d of data.slice(0, 12)) {
    ensure(s, 16, R());
    s.pdf.setFont("helvetica", "normal");
    s.pdf.setFontSize(8);
    s.pdf.setTextColor(60, 66, 82);
    s.pdf.text(String(d.label).slice(0, 22), s.M, s.y + 8);
    s.pdf.setFillColor(...LAV2);
    s.pdf.roundedRect(s.M + 90, s.y + 2, barW, 7, 3, 3, "F");
    const w = Math.max(2, (d.value / max) * barW);
    s.pdf.setFillColor(...INK);
    s.pdf.roundedRect(s.M + 90, s.y + 2, w, 7, 3, 3, "F");
    s.pdf.setTextColor(...MUTED);
    s.pdf.text(String(d.display ?? d.value), s.W - s.M, s.y + 8, { align: "right" });
    s.y += 14;
  }
  s.y += 6;
}
function tableBlock(s: State, title: string, t: BITable) {
  if (!t.rows.length) return;
  ensure(s, 40, R());
  if (title) {
    s.pdf.setFont("helvetica", "bold");
    s.pdf.setFontSize(9.5);
    s.pdf.setTextColor(...INK);
    s.pdf.text(title, s.M, s.y + 8);
    s.y += 14;
  }
  autoTable(s.pdf, {
    startY: s.y,
    margin: { left: s.M, right: s.M, bottom: 48 },
    head: [t.columns],
    body: t.rows.map((r) => r.map((c) => String(c))),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: 40, lineColor: [222, 224, 236], lineWidth: 0.5 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: "normal", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 253] },
    didDrawPage: () => {},
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  s.y = ((s.pdf as any).lastAutoTable?.finalY ?? s.y) + 12;
}
function bulletBlock(s: State, title: string, items: string[]) {
  ensure(s, 20, R());
  s.pdf.setFont("helvetica", "bold");
  s.pdf.setFontSize(9.5);
  s.pdf.setTextColor(...INK);
  s.pdf.text(title, s.M, s.y + 8);
  s.y += 14;
  narrative(s, items);
}
function insightSection(s: State, title: string, items: BIInsight[]) {
  heading(s, title);
  if (!items.length) {
    narrative(s, ["None detected in this period."]);
    return;
  }
  for (const it of items) {
    const detail = s.pdf.splitTextToSize(it.detail, s.W - s.M * 2 - 16);
    const boxH = 22 + detail.length * 11;
    ensure(s, boxH + 8, R());
    const bg: [number, number, number] =
      it.tone === "risk" || it.tone === "negative" ? [254, 242, 242]
      : it.tone === "opportunity" ? [253, 250, 235]
      : it.tone === "positive" ? [240, 250, 244]
      : [248, 249, 253];
    s.pdf.setFillColor(...bg);
    s.pdf.roundedRect(s.M, s.y, s.W - s.M * 2, boxH, 6, 6, "F");
    s.pdf.setFont("helvetica", "bold");
    s.pdf.setFontSize(9.5);
    s.pdf.setTextColor(...INK);
    s.pdf.text(it.title, s.M + 10, s.y + 15);
    s.pdf.setFont("helvetica", "normal");
    s.pdf.setFontSize(8.5);
    s.pdf.setTextColor(70, 78, 96);
    s.pdf.text(detail, s.M + 10, s.y + 28);
    s.y += boxH + 8;
  }
}
function recBlock(s: State, recs: BIReport["recommendations"]) {
  if (!recs.length) { narrative(s, ["No pressing actions — keep doing what works."]); return; }
  let n = 1;
  for (const r of recs) {
    const action = s.pdf.splitTextToSize(`${n}.  ${r.action}`, s.W - s.M * 2 - 70);
    const reason = s.pdf.splitTextToSize(r.reason, s.W - s.M * 2 - 70);
    const boxH = 16 + action.length * 12 + reason.length * 10;
    ensure(s, boxH + 8, R());
    const col: [number, number, number] = r.priority === "High" ? [220, 38, 38] : r.priority === "Medium" ? [217, 119, 6] : [100, 116, 139];
    s.pdf.setFillColor(...col);
    s.pdf.roundedRect(s.M, s.y + 2, 44, 15, 4, 4, "F");
    s.pdf.setTextColor(255, 255, 255);
    s.pdf.setFont("helvetica", "bold");
    s.pdf.setFontSize(7.5);
    s.pdf.text(r.priority.toUpperCase(), s.M + 22, s.y + 12, { align: "center" });
    s.pdf.setTextColor(...INK);
    s.pdf.setFontSize(9.5);
    s.pdf.text(action, s.M + 54, s.y + 12);
    s.pdf.setFont("helvetica", "normal");
    s.pdf.setFontSize(8.5);
    s.pdf.setTextColor(...MUTED);
    s.pdf.text(reason, s.M + 54, s.y + 12 + action.length * 12);
    s.y += boxH + 8;
    n++;
  }
}

// Bind CURRENT_REPORT so helpers can page-break with the header.
function execSummary(s: State, report: BIReport) {
  CURRENT_REPORT = report;
  heading(s, "Executive Summary");
  kpiGrid(s, report.executive.kpis);
  narrative(s, report.executive.narrative);
  // Health drivers
  ensure(s, 20, report);
  s.pdf.setFont("helvetica", "bold");
  s.pdf.setFontSize(9.5);
  s.pdf.setTextColor(...INK);
  s.pdf.text(`Business Health Score: ${report.health.score}/100 (${report.health.grade})`, s.M, s.y + 8);
  s.y += 16;
  barBlock(s, "", report.health.drivers.map((d) => ({ label: d.label, value: d.score, display: `${d.score} · ${d.note}` } as BIBar)));
}
