"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Shared client-side export helpers: Excel (.xlsx) and presentation-ready PDF
// with the company logo, used by every module and the Reports page.

export type PdfBusiness = {
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
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

// The logo files are white-on-black JPEGs; invert them so they read correctly
// on a white PDF page (same trick the print page uses with CSS invert).
// Time-boxed: if the image doesn't load quickly we fall back to a text header
// instead of hanging the export forever.
let cachedLogo: { dataUrl: string; width: number; height: number } | null = null;
export async function loadInvertedLogo() {
  if (cachedLogo) return cachedLogo;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const timer = setTimeout(() => reject(new Error("logo timeout")), 3000);
      el.onload = () => {
        clearTimeout(timer);
        resolve(el);
      };
      el.onerror = (e) => {
        clearTimeout(timer);
        reject(e);
      };
      el.src = "/logo-wordmark.jpeg";
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 255 - data.data[i];
      data.data[i + 1] = 255 - data.data[i + 1];
      data.data[i + 2] = 255 - data.data[i + 2];
    }
    ctx.putImageData(data, 0, 0);
    cachedLogo = {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
    return cachedLogo;
  } catch {
    return null; // fall back to text-only header
  }
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
  const margin = 48;

  // Header: logo (or company name) left, report title right
  const logo = await loadInvertedLogo();
  if (logo) {
    const w = 120;
    const h = (logo.height / logo.width) * w;
    pdf.addImage(logo.dataUrl, "PNG", margin, 44, w, h);
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text(business.companyName || "SOMART", margin, 62);
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  const bizLines = [business.address, business.phone, business.email].filter(
    (l): l is string => Boolean(l)
  );
  if (bizLines.length) pdf.text(bizLines, margin, 86);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(0);
  pdf.text(title.toUpperCase(), pageWidth - margin, 62, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  const meta = [
    subtitle ?? "",
    `Generated ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
  ].filter(Boolean);
  pdf.text(meta, pageWidth - margin, 78, { align: "right" });

  pdf.setDrawColor(0);
  pdf.setLineWidth(1.5);
  pdf.line(margin, 112, pageWidth - margin, 112);

  let startY = 130;

  // KPI summary row
  if (kpis && kpis.length > 0) {
    const cardWidth = (pageWidth - margin * 2 - (kpis.length - 1) * 10) / kpis.length;
    kpis.forEach(([label, value], i) => {
      const x = margin + i * (cardWidth + 10);
      pdf.setFillColor(245, 245, 245);
      pdf.roundedRect(x, startY - 6, cardWidth, 46, 6, 6, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(110);
      pdf.text(label.toUpperCase(), x + 10, startY + 6);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(0);
      pdf.text(value, x + 10, startY + 26);
    });
    startY += 62;
  }

  autoTable(pdf, {
    startY,
    margin: { left: margin, right: margin },
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ""))),
    theme: "striped",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: 30 },
    headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: "bold" },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, c.align === "right" ? { halign: "right" as const } : {}])
    ),
    didDrawPage: () => {
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(
        `${business.companyName || "SOMART"} — ${title}`,
        margin,
        pageHeight - 24
      );
      pdf.text(
        `Page ${pdf.getCurrentPageInfo().pageNumber}`,
        pageWidth - margin,
        pageHeight - 24,
        { align: "right" }
      );
    },
  });

  savePdf(pdf, `${filename}.pdf`);
}
