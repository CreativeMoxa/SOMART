"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// One-click PDF download for invoices/quotations, generated fully client-side
// (no navigation to the print page). Marketing source is deliberately omitted.

export type PdfLineItem = { name: string; price: number; qty: number };

export type PdfDocument = {
  number: string;
  customerName: string;
  customerPhone: string;
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
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function downloadDocumentPdf(
  doc: PdfDocument,
  business: PdfBusiness,
  kind: "invoice" | "quotation"
) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;

  // Header — company block (left)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(0);
  pdf.text(business.companyName || "SOMART", margin, 62);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  const bizLines = [business.address, business.phone, business.email].filter(Boolean);
  if (bizLines.length) pdf.text(bizLines, margin, 78);

  // Header — document block (right)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(0);
  pdf.text(kind === "invoice" ? "INVOICE" : "QUOTATION", pageWidth - margin, 62, {
    align: "right",
  });
  pdf.setFont("courier", "bold");
  pdf.setFontSize(12);
  pdf.text(doc.number, pageWidth - margin, 80, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  const dateStr = new Date(doc.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const meta = [`Date: ${dateStr}`, `Status: ${doc.status}`];
  if (doc.dueDate) meta.push(`Due: ${doc.dueDate}`);
  if (doc.validUntil) meta.push(`Valid until: ${doc.validUntil}`);
  pdf.text(meta, pageWidth - margin, 94, { align: "right" });

  // Divider
  pdf.setDrawColor(0);
  pdf.setLineWidth(1.5);
  pdf.line(margin, 122, pageWidth - margin, 122);

  // Billed to
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(110);
  pdf.text("BILLED TO", margin, 142);
  pdf.setFontSize(13);
  pdf.setTextColor(0);
  pdf.text(doc.customerName, margin, 158);
  if (doc.customerPhone) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    pdf.text(doc.customerPhone, margin, 172);
  }

  // Items table
  autoTable(pdf, {
    startY: 190,
    margin: { left: margin, right: margin },
    head: [["Description", "Unit Price", "Qty", "Amount"]],
    body: doc.items.map((i) => [
      i.name,
      money(i.price),
      String(i.qty),
      money(i.price * i.qty),
    ]),
    theme: "striped",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 7, textColor: 30 },
    headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right", cellWidth: 80 },
      2: { halign: "right", cellWidth: 50 },
      3: { halign: "right", cellWidth: 90 },
    },
  });

  let y =
    (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  // Totals block (right-aligned)
  const labelX = pageWidth - margin - 200;
  const valueX = pageWidth - margin;
  const rows: [string, string][] = [["Subtotal", money(doc.subtotal)]];
  if (doc.discount > 0) rows.push(["Discount", `-${money(doc.discount)}`]);
  if (doc.tax > 0) rows.push(["Tax", money(doc.tax)]);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  for (const [label, value] of rows) {
    pdf.setTextColor(110);
    pdf.text(label, labelX, y);
    pdf.setTextColor(0);
    pdf.text(value, valueX, y, { align: "right" });
    y += 16;
  }
  pdf.setLineWidth(1.2);
  pdf.line(labelX, y - 6, valueX, y - 6);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Total", labelX, y + 12);
  pdf.text(money(doc.total), valueX, y + 12, { align: "right" });
  y += 40;

  // Notes
  if (doc.notes) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(110);
    pdf.text("NOTES", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(30);
    const noteLines = pdf.splitTextToSize(doc.notes, pageWidth - margin * 2);
    pdf.text(noteLines, margin, y + 14);
    y += 14 + noteLines.length * 13;
  }

  // Footer
  if (business.invoiceFooter) {
    pdf.setDrawColor(200);
    pdf.setLineWidth(0.5);
    pdf.line(margin, pageHeight - 64, pageWidth - margin, pageHeight - 64);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    pdf.text(business.invoiceFooter, pageWidth / 2, pageHeight - 48, {
      align: "center",
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
