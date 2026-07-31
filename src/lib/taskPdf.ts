"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { drawDecor, drawHeader, drawFooter, INK, MUTED } from "@/lib/pdfChrome";
import { savePdf, type PdfBusiness } from "@/lib/export";
import { TASK_STATUS_LABELS, PRIORITY_LABELS, type TaskStatus, type Priority } from "@/lib/taskManager";

export type TaskForPdf = {
  number: string;
  title: string;
  assignees?: string[];
  department?: string;
  priority: string;
  status: string;
  dueDate?: string;
  progress?: number;
  internalNotes?: string;
};

function signatureBlock(pdf: jsPDF, pageWidth: number, margin: number, y: number) {
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.5);
  const colW = (pageWidth - margin * 2 - 40) / 3;
  const labels = ["Prepared by", "Signature", "Date"];
  labels.forEach((label, i) => {
    const x = margin + i * (colW + 20);
    pdf.line(x, y, x + colW, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text(label, x, y + 12);
  });
}

// Professional filled task report — landscape A4, branded header, a table of
// the tasks and a signature block.
export async function exportTasksPdf(
  tasks: TaskForPdf[],
  business: PdfBusiness,
  opts?: { title?: string; subtitle?: string; kpis?: [string, string][] }
) {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;

  drawDecor(pdf, pageWidth, pageHeight);
  await drawHeader(pdf, {
    pageWidth,
    margin,
    tagline: business.tagline || business.companyName,
    location: business.address,
  });

  const titleY = 176;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(20);
  pdf.setTextColor(...INK);
  pdf.text(opts?.title ?? "Task Report", margin, titleY);
  pdf.setFontSize(9.5);
  pdf.setTextColor(...MUTED);
  pdf.text(
    [
      opts?.subtitle ?? "",
      `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    ].filter(Boolean),
    pageWidth - margin,
    titleY,
    { align: "right" }
  );

  let startY = titleY + 22;
  const kpis = opts?.kpis ?? [];
  if (kpis.length) {
    const cardWidth = (pageWidth - margin * 2 - (kpis.length - 1) * 10) / kpis.length;
    kpis.forEach(([label, value], i) => {
      const x = margin + i * (cardWidth + 10);
      pdf.setFillColor(245, 245, 245);
      pdf.roundedRect(x, startY - 6, cardWidth, 46, 6, 6, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...MUTED);
      pdf.text(label.toUpperCase(), x + 10, startY + 6);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(...INK);
      pdf.text(value, x + 10, startY + 26);
    });
    startY += 62;
  }

  autoTable(pdf, {
    startY,
    margin: { left: margin, right: margin, bottom: 70 },
    head: [["ID", "Task", "Assigned to", "Dept", "Priority", "Status", "Due", "Progress", "Notes"]],
    body: tasks.map((t) => [
      t.number,
      t.title,
      (t.assignees ?? []).join(", ") || "—",
      t.department ?? "",
      PRIORITY_LABELS[t.priority as Priority] ?? t.priority,
      TASK_STATUS_LABELS[t.status as TaskStatus] ?? t.status,
      t.dueDate || "—",
      `${t.progress ?? 0}%`,
      t.internalNotes ?? "",
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, textColor: 40, lineColor: [206, 206, 206], lineWidth: 0.5 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: "normal" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 1: { cellWidth: 150 }, 8: { cellWidth: 150 } },
  });

  // Signature block under the table (or on a fresh area if near the bottom).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const endY = (pdf as any).lastAutoTable?.finalY ?? startY;
  const sigY = Math.min(endY + 46, pageHeight - 60);
  signatureBlock(pdf, pageWidth, margin, sigY);

  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    drawFooter(pdf, { pageWidth, pageHeight, footer: business.invoiceFooter, pageNumber: p, pageCount });
  }

  savePdf(pdf, "task-report.pdf");
}

// Blank weekly planning sheet — landscape A4, made for printing and filling in
// by hand during a planning session.
export async function exportBlankPlanningSheet(business: PdfBusiness) {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;

  drawDecor(pdf, pageWidth, pageHeight);
  await drawHeader(pdf, {
    pageWidth,
    margin,
    tagline: business.tagline || business.companyName,
    location: business.address,
  });

  const titleY = 172;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.setTextColor(...INK);
  pdf.text("Weekly Task Planning Sheet", margin, titleY);

  // Top fields: Week / Date / Manager on one row, then Main Goal.
  pdf.setDrawColor(150, 150, 150);
  pdf.setLineWidth(0.6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);

  const rowY = titleY + 26;
  const fieldW = (pageWidth - margin * 2 - 40) / 3;
  const fields = ["Week", "Date", "Manager"];
  fields.forEach((label, i) => {
    const x = margin + i * (fieldW + 20);
    pdf.text(`${label}:`, x, rowY);
    const labelW = pdf.getTextWidth(`${label}: `);
    pdf.line(x + labelW, rowY + 2, x + fieldW, rowY + 2);
  });

  const goalY = rowY + 28;
  pdf.text("Main Goal for the Week:", margin, goalY);
  const goalLabelW = pdf.getTextWidth("Main Goal for the Week: ");
  pdf.line(margin + goalLabelW, goalY + 2, pageWidth - margin, goalY + 2);

  // Large blank table with tall rows for handwriting.
  autoTable(pdf, {
    startY: goalY + 18,
    margin: { left: margin, right: margin, bottom: 60 },
    head: [["Task", "Assigned To", "Priority", "Due Date", "Status", "Notes"]],
    body: Array.from({ length: 12 }, () => ["", "", "", "", "", ""]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 10, minCellHeight: 30, cellPadding: 6, lineColor: [150, 150, 150], lineWidth: 0.6 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: "normal", minCellHeight: 22 },
    columnStyles: {
      0: { cellWidth: 220 },
      1: { cellWidth: 120 },
      2: { cellWidth: 80 },
      3: { cellWidth: 95 },
      4: { cellWidth: 95 },
    },
  });

  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    drawFooter(pdf, { pageWidth, pageHeight, footer: business.invoiceFooter, pageNumber: p, pageCount });
  }

  savePdf(pdf, "weekly-planning-sheet.pdf");
}
