"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { savePdf } from "@/lib/export";

// Client-side generators for the three BLANK accounting sheets. They build a
// real A4 PDF file and download it immediately — no print dialog.

const INK: [number, number, number] = [17, 17, 17];
const GREY = 120;
const M = 28; // page margin (pt)

type Branding = { company: string; logo: { data: string; fmt: "PNG" | "JPEG" } | null };

async function loadLogo(url: string): Promise<Branding["logo"]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const fmt: "PNG" | "JPEG" = /image\/jpe?g/i.test(data) ? "JPEG" : "PNG";
    return { data, fmt };
  } catch {
    return null;
  }
}

async function getBranding(): Promise<Branding> {
  let company = "SOMART";
  let logoUrl = "/logo-mark-navy.png";
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const s = await res.json();
      company = s.companyName || "SOMART";
      logoUrl = s.elementLogoUrl || "/logo-mark-navy.png";
    }
  } catch {
    /* fall back to defaults */
  }
  return { company, logo: await loadLogo(logoUrl) };
}

// Header band; returns the Y below it.
function header(pdf: jsPDF, b: Branding, title: string): number {
  const W = pdf.internal.pageSize.getWidth();
  const hasLogo = Boolean(b.logo);
  if (b.logo) pdf.addImage(b.logo.data, b.logo.fmt, M, M, 34, 34);
  const tx = M + (hasLogo ? 42 : 0);
  pdf.setFont("helvetica", "bold").setFontSize(15).setTextColor(...INK);
  pdf.text(b.company, tx, M + 15);
  pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90);
  pdf.text(title.toUpperCase(), tx, M + 29);
  pdf.setDrawColor(...INK).setLineWidth(1.1).line(M, M + 42, W - M, M + 42);
  return M + 42;
}

// A "Label: ____" blank; the line runs to endX.
function labelBlank(pdf: jsPDF, x: number, y: number, label: string, endX: number, bold = false) {
  pdf.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8).setTextColor(...INK);
  pdf.text(label, x, y);
  const start = x + pdf.getTextWidth(label) + 4;
  pdf.setDrawColor(GREY).setLineWidth(0.5).line(start, y + 1.5, endX, y + 1.5);
}

function tableStyles(minCellHeight: number) {
  return {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: 20, lineColor: [70, 70, 70] as [number, number, number], lineWidth: 0.5, minCellHeight },
    headStyles: { fillColor: [235, 235, 235] as [number, number, number], textColor: 20, fontStyle: "bold" as const, fontSize: 7.5 },
  };
}

// Saturday → Friday week of a reference date.
function startOfWeek(ref = new Date()): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return d;
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── PDF 1 — Weekly Accounting Sheet ────────────────────────────────────────
export async function downloadWeeklySheet() {
  const b = await getBranding();
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  let y = header(pdf, b, "Weekly Accounting Sheet") + 18;

  labelBlank(pdf, W - M - 190, M + 12, "Week Starting:", W - M);
  labelBlank(pdf, W - M - 190, M + 25, "Week Ending:", W - M);

  labelBlank(pdf, M, y, "Opening Balance:", M + 220);
  y += 16;

  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Day", "Date", "Income / Sales", "Expenses", "Other Income", "Other Expenses", "Net Balance", "Notes"]],
    body: WEEKDAYS.map((d) => [d, "", "", "", "", "", "", ""]),
    ...tableStyles(30),
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 54 } },
  });
  // @ts-expect-error autoTable augments the instance
  y = pdf.lastAutoTable.finalY + 22;

  pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK);
  pdf.text("WEEKLY TOTALS", M, y);
  y += 14;
  const colW = (W - 2 * M - 20) / 2;
  const pairs: [string, number][] = [["Total Income:", 0], ["Total Expenses:", 1], ["Other Income:", 0], ["Other Expenses:", 1], ["Net Balance:", 0], ["Closing Balance:", 1]];
  pairs.forEach(([label], i) => {
    const col = i % 2;
    const x = M + col * (colW + 20);
    if (col === 0 && i > 0) y += 18;
    if (i === 0) {} // first row already at y
    labelBlank(pdf, x, y, label, x + colW);
  });
  y += 26;

  pdf.setFont("helvetica", "bold").setFontSize(9);
  pdf.text("NOTES / IMPORTANT TRANSACTIONS", M, y);
  y += 16;
  for (let i = 0; i < 4; i++) { pdf.setDrawColor(GREY).setLineWidth(0.5).line(M, y, W - M, y); y += 22; }

  y += 12;
  const sw = (W - 2 * M - 40) / 3;
  ["Prepared By:", "Checked By:", "Date:"].forEach((label, i) => {
    const x = M + i * (sw + 20);
    pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...INK);
    pdf.text(label, x, y);
    pdf.setDrawColor(GREY).line(x, y + 26, x + sw, y + 26);
  });

  savePdf(pdf, "SOMART-weekly-accounting-sheet.pdf");
}

// ── PDF 3 — Monthly Accounting Sheet ───────────────────────────────────────
export async function downloadMonthlySheet() {
  const b = await getBranding();
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const all = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const mid = Math.ceil(daysInMonth / 2);

  let y = header(pdf, b, "Monthly Accounting Sheet") + 14;
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...INK);
  pdf.text(`Month: ${MONTHS[now.getMonth()]}    Year: ${now.getFullYear()}`, M, y);
  labelBlank(pdf, W - M - 210, y, "Opening Balance:", W - M);
  y += 14;

  const half = (W - 2 * M - 14) / 2;
  const startY = y;
  autoTable(pdf, {
    startY, margin: { left: M }, tableWidth: half,
    head: [["Date", "Income", "Expenses", "Net Balance"]],
    body: all.slice(0, mid).map((d) => [String(d), "", "", ""]),
    ...tableStyles(15),
  });
  autoTable(pdf, {
    startY, margin: { left: M + half + 14 }, tableWidth: half,
    head: [["Date", "Income", "Expenses", "Net Balance"]],
    body: all.slice(mid).map((d) => [String(d), "", "", ""]),
    ...tableStyles(15),
  });
  // @ts-expect-error autoTable augments the instance
  y = pdf.lastAutoTable.finalY + 22;

  pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK);
  pdf.text("MONTHLY TOTALS", M, y);
  y += 14;
  const colW = (W - 2 * M - 20) / 2;
  [["Total Income:", 0], ["Total Expenses:", 1], ["Net Balance:", 0], ["Closing Balance:", 1]].forEach((p, i) => {
    const col = (p[1] as number);
    const x = M + col * (colW + 20);
    if (col === 0 && i > 0) y += 18;
    labelBlank(pdf, x, y, p[0] as string, x + colW);
  });
  y += 26;

  pdf.setFont("helvetica", "bold").setFontSize(9);
  pdf.text("NOTES", M, y);
  y += 16;
  for (let i = 0; i < 3; i++) { pdf.setDrawColor(GREY).setLineWidth(0.5).line(M, y, W - M, y); y += 20; }

  y += 10;
  const sw = (W - 2 * M - 40) / 3;
  ["Prepared By:", "Checked By:", "Date:"].forEach((label, i) => {
    const x = M + i * (sw + 20);
    pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...INK);
    pdf.text(label, x, y);
    pdf.setDrawColor(GREY).line(x, y + 24, x + sw, y + 24);
  });

  savePdf(pdf, "SOMART-monthly-accounting-sheet.pdf");
}

// ── PDF 2 — Weekly Daily Cash & Accounting ─────────────────────────────────
const CASH = ["ZAAD $", "SL CASH", "EDAHAB", "EBIRR", "PREMIER WALLET"];
export async function downloadCashSheet() {
  const b = await getBranding();
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const sat = startOfWeek();
  const days = WEEKDAYS.map((name, i) => ({ name, date: ymd(new Date(sat.getTime() + i * 86400000)) }));

  let y = header(pdf, b, "Weekly Daily Cash & Accounting") + 12;
  pdf.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...INK);
  pdf.text(`Week: ${days[0].date}  →  ${days[6].date}`, M, y);
  y += 8;

  const innerW = W - 2 * M;
  const gap = 4;
  const blockH = (H - y - M - 6 * gap) / 7; // 7 blocks fill the page
  const c1x = M + 8, c1w = innerW * 0.40;
  const c2x = M + innerW * 0.42, c2w = innerW * 0.34;
  const c3x = M + innerW * 0.78, c3w = innerW * 0.20;

  days.forEach((d) => {
    const by = y;
    pdf.setDrawColor(60).setLineWidth(0.7).rect(M, by, innerW, blockH);
    // Title row
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK);
    pdf.text(`${d.name.toUpperCase()} — ${d.date}`, M + 6, by + 13);
    labelBlank(pdf, M + innerW * 0.5, by + 13, "Revenue:", M + innerW * 0.72);
    labelBlank(pdf, M + innerW * 0.74, by + 13, "Profit:", M + innerW - 6);
    pdf.setDrawColor(180).setLineWidth(0.4).line(M, by + 18, M + innerW, by + 18);

    let ry = by + 30;
    // Cash collection
    pdf.setFont("helvetica", "bold").setFontSize(7).setTextColor(...INK);
    pdf.text("CASH COLLECTION", c1x, ry - 4);
    CASH.forEach((c) => { labelBlank(pdf, c1x, ry + 4, `${c}:`, c1x + c1w - 6); ry += 10.5; });
    labelBlank(pdf, c1x, ry + 4, "TOTAL:", c1x + c1w - 6, true);

    // Expense
    let ey = by + 30;
    pdf.setFont("helvetica", "bold").setFontSize(7).setTextColor(...INK);
    pdf.text("EXPENSE", c2x, ey - 4);
    for (let n = 1; n <= 5; n++) {
      pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...INK);
      pdf.text(`${n}.`, c2x, ey + 4);
      pdf.setDrawColor(GREY).setLineWidth(0.5);
      pdf.line(c2x + 12, ey + 5, c2x + c2w - 44, ey + 5); // description
      pdf.text("=", c2x + c2w - 40, ey + 4);
      pdf.line(c2x + c2w - 32, ey + 5, c2x + c2w - 4, ey + 5); // amount
      ey += 10.5;
    }
    labelBlank(pdf, c2x, ey + 4, "TOTAL EXPENSE:", c2x + c2w - 4, true);

    // Goals
    let gy = by + 30;
    pdf.setFont("helvetica", "bold").setFontSize(7).setTextColor(...INK);
    pdf.text("GOALS", c3x, gy - 4);
    pdf.setFont("helvetica", "normal").setFontSize(8);
    pdf.setDrawColor(GREY).line(c3x, gy + 5, c3x + 24, gy + 5);
    pdf.text("Orders", c3x + 28, gy + 4); gy += 14;
    pdf.setDrawColor(GREY).line(c3x, gy + 5, c3x + 24, gy + 5);
    pdf.text("Sunglasses", c3x + 28, gy + 4);

    y += blockH + gap;
  });

  savePdf(pdf, "SOMART-weekly-cash-sheet.pdf");
}
