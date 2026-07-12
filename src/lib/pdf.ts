"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  drawDecor,
  drawHeader,
  drawFooter,
  BAND_GREY,
  INK,
  MUTED,
} from "@/lib/pdfChrome";

// One-click PDF download for invoices/quotations, generated fully client-side
// to match the branded template (grey corner curves, tagline+logo header,
// customer block, date band, black-header table, totals box, thank-you footer).

export type PdfLineItem = { name: string; price: number; qty: number };

export type PdfDocument = {
  number: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: PdfLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  dueDate?: string;
  validUntil?: string;
  notes: string;
  createdAt: string;
};

export type PdfBusiness = {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  invoiceFooter: string;
  tagline?: string;
  bankAccount?: string;
  currencySymbol?: string;
};

function shortDate(d: string | Date) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}/${date.getFullYear()}`;
}

export async function downloadDocumentPdf(
  doc: PdfDocument,
  business: PdfBusiness,
  kind: "invoice" | "quotation"
) {
  const symbol = business.currencySymbol || "$";
  const money = (n: number) => `${symbol} ${n.toFixed(2)}`;

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
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

  // Customer block (left) + document title (right).
  const blockY = 176;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(...INK);
  pdf.text(doc.customerName || "Customer", margin, blockY);
  if (doc.customerAddress) {
    pdf.setFontSize(10);
    pdf.setTextColor(...MUTED);
    const addrLines = pdf.splitTextToSize(doc.customerAddress, 220);
    pdf.text(addrLines, margin, blockY + 15);
  }

  const title = kind === "invoice" ? "Invoice" : "Quotation";
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(21);
  pdf.setTextColor(...INK);
  pdf.text(`${title} ${doc.number}`, pageWidth - margin, blockY + 6, {
    align: "right",
  });

  // Date band (full-width soft-grey rounded panel).
  const bandY = 214;
  const bandH = 48;
  pdf.setFillColor(...BAND_GREY);
  pdf.roundedRect(margin, bandY, pageWidth - margin * 2, bandH, 5, 5, "F");
  const col2X = margin + (pageWidth - margin * 2) * 0.44;
  const leftLabel = kind === "invoice" ? "Invoice Date" : "Quotation Date";
  const rightLabel = kind === "invoice" ? "Due Date" : "Valid Until";
  const rightValue = kind === "invoice" ? doc.dueDate : doc.validUntil;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...INK);
  pdf.text(leftLabel, margin + 16, bandY + 19);
  pdf.text(rightLabel, col2X, bandY + 19);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...MUTED);
  pdf.text(shortDate(doc.createdAt), margin + 16, bandY + 35);
  if (rightValue) pdf.text(shortDate(rightValue), col2X, bandY + 35);

  // Items table.
  autoTable(pdf, {
    startY: bandY + bandH + 18,
    margin: { left: margin, right: margin },
    head: [["Description", "Quantity", "Unit Price", "Amount"]],
    body: doc.items.map((i) => [
      i.name,
      i.qty.toFixed(2),
      i.price.toFixed(2),
      money(i.price * i.qty),
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: { top: 8, right: 10, bottom: 8, left: 12 },
      lineColor: [206, 206, 206],
      lineWidth: 0.5,
      textColor: 40,
    },
    headStyles: {
      fillColor: INK,
      textColor: 255,
      fontStyle: "normal",
      cellPadding: { top: 9, right: 10, bottom: 9, left: 12 },
    },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right", cellWidth: 72 },
      2: { halign: "right", cellWidth: 76 },
      3: { halign: "right", cellWidth: 84, fillColor: [245, 245, 245] },
    },
  });

  const finalY =
    (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Totals box (right), with optional breakdown above the black Total row.
  const boxRight = pageWidth - margin;
  const boxLeft = boxRight - 235;
  const rowH = 26;
  let ry = finalY;

  const drawTotalRow = (
    label: string,
    value: string,
    opts: { black?: boolean; bold?: boolean; italic?: boolean } = {}
  ) => {
    if (opts.black) {
      pdf.setFillColor(...INK);
      pdf.rect(boxLeft, ry, boxRight - boxLeft, rowH, "F");
      pdf.setTextColor(255);
    } else {
      pdf.setDrawColor(210);
      pdf.setLineWidth(0.5);
      pdf.rect(boxLeft, ry, boxRight - boxLeft, rowH, "S");
      pdf.setTextColor(...INK);
    }
    pdf.setFontSize(10.5);
    pdf.setFont("helvetica", opts.italic ? "italic" : opts.bold ? "bold" : "normal");
    pdf.text(label, boxLeft + 12, ry + rowH / 2 + 3.5);
    pdf.setFont("helvetica", opts.black || opts.bold ? "bold" : "normal");
    pdf.text(value, boxRight - 12, ry + rowH / 2 + 3.5, { align: "right" });
    ry += rowH;
  };

  if (doc.discount > 0 || doc.tax > 0) {
    drawTotalRow("Subtotal", money(doc.subtotal));
    if (doc.discount > 0) drawTotalRow("Discount", `- ${money(doc.discount)}`);
    if (doc.tax > 0) drawTotalRow("Tax", money(doc.tax));
  }
  drawTotalRow("Total", money(doc.total), { black: true });
  const isPaid = kind === "invoice" && doc.status === "paid";
  if (isPaid) {
    drawTotalRow(`Paid on ${shortDate(doc.createdAt)}`, money(doc.total), {
      italic: true,
    });
    drawTotalRow("Amount Due", money(0), { bold: true });
  } else if (kind === "invoice") {
    drawTotalRow("Amount Due", money(doc.total), { bold: true });
  }

  // Payment info (left), aligned near the top of the totals box.
  let py = finalY + 18;
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  const commLabel = "Payment Communication: ";
  pdf.setFont("helvetica", "normal");
  pdf.text(commLabel, margin, py);
  pdf.setFont("helvetica", "bold");
  pdf.text(doc.number, margin + pdf.getTextWidth(commLabel), py);
  if (business.bankAccount) {
    py += 16;
    const acctLabel = "on this account: ";
    pdf.setFont("helvetica", "normal");
    pdf.text(acctLabel, margin, py);
    pdf.setFont("helvetica", "bold");
    pdf.text(business.bankAccount, margin + pdf.getTextWidth(acctLabel), py);
  }

  // Notes (below both columns).
  const belowY = Math.max(ry, py) + 24;
  if (doc.notes) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text("NOTES", margin, belowY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(40);
    pdf.text(pdf.splitTextToSize(doc.notes, pageWidth - margin * 2), margin, belowY + 14);
  }

  // Footer on every page.
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

  // Manual blob download — reliable in every browser context.
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.number}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
