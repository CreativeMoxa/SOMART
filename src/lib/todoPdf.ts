"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { drawDecor, drawHeader, drawFooter, INK, MUTED } from "@/lib/pdfChrome";
import { savePdf, type PdfBusiness } from "@/lib/export";
import {
  TODO_TYPE_LABELS,
  TODO_STATUS_LABELS,
  itemUnits,
  todoProgress,
  todoStatus,
  type TodoType,
  type TodoItem,
} from "@/lib/todoList";

export type TodoForPdf = {
  number: string;
  title: string;
  type: TodoType;
  notes?: string;
  dueDate?: string;
  items: TodoItem[];
  createdAt?: string;
};

function fmt(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// One branded PDF per to-do list: header + meta (type, deadline, progress) and
// a table of every item with its done/target and status.
export async function exportTodoPdf(todo: TodoForPdf, business: PdfBusiness) {
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

  const prog = todoProgress(todo.items);
  const status = todoStatus(todo);

  let y = 150;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text("TO-DO LIST", margin, y);
  y += 20;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(20);
  pdf.setTextColor(...INK);
  pdf.text(`${todo.title}`, margin, y);
  pdf.setFontSize(11);
  pdf.setTextColor(...MUTED);
  pdf.text(todo.number, pageWidth - margin, y, { align: "right" });

  y += 22;
  pdf.setFontSize(10);
  pdf.setTextColor(...MUTED);
  const meta = [
    `Type: ${TODO_TYPE_LABELS[todo.type] ?? todo.type}`,
    `Deadline: ${fmt(todo.dueDate)}`,
    `Status: ${TODO_STATUS_LABELS[status]}`,
    `Progress: ${prog.done}/${prog.total} (${prog.percent}%)`,
  ].join("      ");
  pdf.text(meta, margin, y);

  if (todo.notes) {
    y += 18;
    pdf.setFontSize(10);
    pdf.setTextColor(60);
    pdf.text(pdf.splitTextToSize(`Notes: ${todo.notes}`, pageWidth - margin * 2), margin, y);
    y += 4;
  }

  autoTable(pdf, {
    startY: y + 14,
    margin: { left: margin, right: margin },
    head: [["#", "Item", "Done", "Target", "Status"]],
    body: todo.items.map((it, i) => {
      const u = itemUnits(it);
      return [
        String(i + 1),
        it.title || "—",
        String(u.done),
        String(u.target),
        u.done >= u.target ? "Done" : "In progress",
      ];
    }),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 7, lineColor: [216, 218, 232], lineWidth: 0.5 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: "normal" },
    columnStyles: {
      0: { cellWidth: 34, halign: "center" },
      2: { cellWidth: 60, halign: "right" },
      3: { cellWidth: 60, halign: "right" },
      4: { cellWidth: 90, halign: "center" },
    },
  });

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

  savePdf(pdf, `${todo.number}-${todo.title}.pdf`);
}
