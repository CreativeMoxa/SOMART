"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { drawDecor, drawHeader, drawFooter, INK, MUTED } from "@/lib/pdfChrome";

// Shared client-side export helpers: Excel (.xlsx) and presentation-ready PDF
// that matches the branded invoice template (grey corner curves, tagline+logo
// header, black-header table, thank-you footer), used by every module.

export type PdfBusiness = {
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  tagline?: string;
  invoiceFooter?: string;
};

export type PdfColumn = { header: string; key: string; align?: "right" };

export function exportExcel(filename: string, rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Reliable download that works in every browser context (jsPDF's built-in
// save() can silently no-op in some embedded/webview environments).
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function savePdf(pdf: jsPDF, filename: string) {
  downloadBlob(pdf.output("blob"), filename);
}

export async function exportPdf({
  filename,
  title,
  subtitle,
  business,
  columns,
  rows,
  kpis,
  landscape = false,
}: {
  filename: string;
  title: string;
  subtitle?: string;
  business: PdfBusiness;
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
  kpis?: [string, string][];
  landscape?: boolean;
}) {
  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
    orientation: landscape ? "landscape" : "portrait",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;

  // Branded chrome: grey corner curves + tagline/logo/location header.
  drawDecor(pdf, pageWidth, pageHeight);
  await drawHeader(pdf, {
    pageWidth,
    margin,
    tagline: business.tagline || business.companyName,
    location: business.address,
  });

  // Report title (left) + subtitle & generated date (right).
  const titleY = 176;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(20);
  pdf.setTextColor(...INK);
  pdf.text(title, margin, titleY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...MUTED);
  const meta = [
    subtitle ?? "",
    `Generated ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
  ].filter(Boolean);
  pdf.text(meta, pageWidth - margin, titleY, { align: "right" });

  let startY = titleY + 22;

  // KPI summary row
  if (kpis && kpis.length > 0) {
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
    margin: { left: margin, right: margin, bottom: 64 },
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ""))),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      textColor: 40,
      lineColor: [206, 206, 206],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: "normal" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, c.align === "right" ? { halign: "right" as const } : {}])
    ),
  });

  // Thank-you footer + page numbers on every page.
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    drawFooter(pdf, {
      pageWidth,
      pageHeight,
      footer: business.invoiceFooter,
      pageNumber: p,
      pageCount,
    });
  }

  savePdf(pdf, `${filename}.pdf`);
}
