import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db";
import { getCurrentUser, requestContext } from "@/lib/auth";
import type { Model } from "mongoose";

import { Product } from "@/models/Product";
import { Customer } from "@/models/Customer";
import { Sale } from "@/models/Sale";
import { Invoice } from "@/models/Invoice";
import { Quotation } from "@/models/Quotation";
import { Expense } from "@/models/Expense";
import { Shipment } from "@/models/Shipment";
import { InventoryMovement } from "@/models/InventoryMovement";
import { Employee } from "@/models/Employee";
import { logActivity } from "@/models/ActivityLog";
import { paymentMethodLabel } from "@/lib/payment";
import { SOURCE_LABELS, type MarketingSource } from "@/lib/marketing";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Full database backup as one .xlsx workbook — a sheet per module, in clean,
// human-readable columns (no internal ids or JSON blobs). Owner-only, since it
// spans every module including employees.

type Row = Record<string, string | number>;
type Doc = Record<string, unknown>;
type Entry = {
  sheet: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  filter?: Record<string, unknown>;
  // How the date range applies: "createdAt"/"date" filter by that field,
  // "none" = always export the full set (reference data like the catalog,
  // customer list and team belong in every backup regardless of the range).
  dateField: "createdAt" | "date" | "none";
  sort?: Record<string, 1 | -1>;
  map: (doc: Doc, index: number) => Row;
};

// ---- formatters ---------------------------------------------------------
const day = (v: unknown): string => {
  if (!v) return "";
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
const num = (v: unknown): number =>
  typeof v === "number" ? Math.round(v * 100) / 100 : 0;
const yesNo = (v: unknown): string => (v ? "Yes" : "No");
const text = (v: unknown): string => (v == null ? "" : String(v));
const sourceLabel = (v: unknown): string =>
  SOURCE_LABELS[v as MarketingSource] ?? text(v);
// "2× Ray-Ban @ 50; 1× Case @ 10"
const itemsText = (items: unknown): string => {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items
    .map((it: Doc) => {
      const qty = it.qty ?? 1;
      const name = it.name ?? "item";
      const price = it.price;
      return `${qty}× ${name}${price != null ? ` @ ${price}` : ""}`;
    })
    .join("; ");
};

// ---- one config per module ----------------------------------------------
const ENTRIES: Entry[] = [
  {
    sheet: "Products",
    model: Product,
    dateField: "none",
    sort: { name: 1 },
    map: (p, i) => ({
      "No.": i + 1,
      Name: text(p.name),
      Brand: text(p.brand),
      Category: text(p.category),
      Gender: text(p.gender),
      Price: num(p.price),
      Cost: num(p.costPrice),
      "Discount %": num(p.discountPercent),
      Stock: num(p.stockQty),
      "Min Stock": num(p.minStock),
      Sold: num(p.soldCount),
      "In Stock": yesNo(p.inStock),
      Visible: yesNo(p.visible),
      Added: day(p.createdAt),
    }),
  },
  {
    sheet: "Customers",
    model: Customer,
    dateField: "none",
    sort: { name: 1 },
    map: (c, i) => ({
      "No.": i + 1,
      Name: text(c.name),
      Phone: text(c.phone),
      Email: text(c.email),
      Address: text(c.address),
      Notes: text(c.notes),
      Added: day(c.createdAt),
    }),
  },
  {
    sheet: "Sales",
    model: Sale,
    dateField: "createdAt",
    sort: { createdAt: 1 },
    map: (s, i) => ({
      "No.": i + 1,
      "Sale #": text(s.number),
      Date: day(s.createdAt),
      Customer: text(s.customerName),
      Items: itemsText(s.items),
      Payment: paymentMethodLabel(s.paymentMethod),
      Source: sourceLabel(s.source),
      Type: text(s.customerType),
      Status: text(s.status),
      Subtotal: num(s.subtotal),
      Discount: num(s.discount),
      Total: num(s.total),
      Cost: num(s.totalCost),
      Profit: num(s.profit),
      Note: text(s.note),
    }),
  },
  {
    sheet: "Invoices",
    model: Invoice,
    dateField: "createdAt",
    sort: { createdAt: 1 },
    map: (v, i) => ({
      "No.": i + 1,
      "Invoice #": text(v.number),
      Date: day(v.createdAt),
      Customer: text(v.customerName),
      Phone: text(v.customerPhone),
      Items: itemsText(v.items),
      Payment: paymentMethodLabel(v.paymentMethod),
      Source: sourceLabel(v.source),
      Status: text(v.status),
      "Due Date": text(v.dueDate),
      Subtotal: num(v.subtotal),
      Discount: num(v.discount),
      Tax: num(v.tax),
      Total: num(v.total),
      Cost: num(v.totalCost),
      Profit: num(v.profit),
      Notes: text(v.notes),
    }),
  },
  {
    sheet: "Quotations",
    model: Quotation,
    dateField: "createdAt",
    sort: { createdAt: 1 },
    map: (q, i) => ({
      "No.": i + 1,
      "Quote #": text(q.number),
      Date: day(q.createdAt),
      Customer: text(q.customerName),
      Phone: text(q.customerPhone),
      Items: itemsText(q.items),
      Status: text(q.status),
      "Valid Until": text(q.validUntil),
      Subtotal: num(q.subtotal),
      Discount: num(q.discount),
      Tax: num(q.tax),
      Total: num(q.total),
      Profit: num(q.profit),
      Notes: text(q.notes),
    }),
  },
  {
    sheet: "Accounting",
    model: Expense,
    dateField: "date",
    sort: { date: 1 },
    map: (e, i) => ({
      "No.": i + 1,
      Title: text(e.title),
      Category: text(e.category),
      Amount: num(e.amount),
      Date: text(e.date),
      Notes: text(e.notes),
    }),
  },
  {
    sheet: "Air Freight",
    model: Shipment,
    filter: { freightType: "air" },
    dateField: "createdAt",
    sort: { createdAt: 1 },
    map: (s, i) => ({
      "No.": i + 1,
      "Shipment #": text(s.number),
      Name: text(s.name),
      Cargo: text(s.cargo),
      Items: itemsText(s.items),
      Tracking: text(s.trackingNumber),
      Status: text(s.status),
      "Shipping Date": text(s.shippingDate),
      "Expected Arrival": text(s.expectedArrival),
      "Total Qty": num(s.totalQty),
      "Total Cost": num(s.totalCost),
      "Expected Sales": num(s.expectedSalesValue),
      Notes: text(s.notes),
      Added: day(s.createdAt),
    }),
  },
  {
    sheet: "Sea Freight",
    model: Shipment,
    filter: { freightType: "sea" },
    dateField: "createdAt",
    sort: { createdAt: 1 },
    map: (s, i) => ({
      "No.": i + 1,
      "Shipment #": text(s.number),
      Name: text(s.name),
      Cargo: text(s.cargo),
      Items: itemsText(s.items),
      Tracking: text(s.trackingNumber),
      Status: text(s.status),
      "Shipping Date": text(s.shippingDate),
      "Expected Arrival": text(s.expectedArrival),
      "Total Qty": num(s.totalQty),
      "Total Cost": num(s.totalCost),
      "Expected Sales": num(s.expectedSalesValue),
      Notes: text(s.notes),
      Added: day(s.createdAt),
    }),
  },
  {
    sheet: "Inventory Moves",
    model: InventoryMovement,
    dateField: "createdAt",
    sort: { createdAt: 1 },
    map: (m, i) => ({
      "No.": i + 1,
      Date: day(m.createdAt),
      Product: text(m.productName),
      Type: text(m.type),
      Before: num(m.qtyBefore),
      Change: num(m.qtyChange),
      After: num(m.qtyAfter),
      Reference: text(m.reference),
      Note: text(m.note),
      By: text(m.user),
    }),
  },
  {
    sheet: "Employees",
    model: Employee,
    dateField: "none",
    sort: { name: 1 },
    map: (e, i) => ({
      "No.": i + 1,
      Name: text(e.name),
      Email: text(e.email),
      Phone: text(e.phone),
      Role: ROLE_LABELS[e.role as Role] ?? text(e.role),
      Status: text(e.status),
      Registered: day(e.registeredAt),
      "Last Login": day(e.lastLoginAt),
      Added: day(e.createdAt),
    }),
  },
];

function buildQuery(
  entry: Entry,
  fromStr: string,
  toStr: string,
  from: Date,
  to: Date
): Record<string, unknown> {
  const q: Record<string, unknown> = { ...(entry.filter ?? {}) };
  if (entry.dateField === "createdAt") {
    q.createdAt = { $gte: from, $lte: to };
  } else if (entry.dateField === "date") {
    const d: Record<string, string> = {};
    if (fromStr) d.$gte = fromStr;
    if (toStr) d.$lte = toStr;
    if (Object.keys(d).length) q.date = d;
  }
  return q;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "founder-ceo") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    await connectDB();
    const { searchParams } = req.nextUrl;
    const fromStr = searchParams.get("from") || "";
    const toStr = searchParams.get("to") || "";

    // Empty dates mean "no bound" — so an empty range backs up everything.
    const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : new Date(0);
    const to = toStr
      ? new Date(new Date(`${toStr}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000 - 1)
      : new Date();
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
    }

    const wb = XLSX.utils.book_new();
    const counts: Record<string, number> = {};

    for (const entry of ENTRIES) {
      const docs = (await entry.model
        .find(buildQuery(entry, fromStr, toStr, from, to))
        .sort(entry.sort ?? { createdAt: 1 })
        .lean()) as Doc[];
      counts[entry.sheet] = docs.length;
      const rows: Row[] = docs.length
        ? docs.map((d, i) => entry.map(d, i))
        : [{ Note: "No records in this date range" }];
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, entry.sheet.slice(0, 31));
    }

    // Summary sheet up front.
    const summary: Row[] = [
      { Field: "Business", Value: "SOMART" },
      { Field: "Date range", Value: `${fromStr || "beginning"} → ${toStr || "today"}` },
      { Field: "Generated", Value: new Date().toISOString().slice(0, 16).replace("T", " ") },
      { Field: "Generated by", Value: user.name || user.email },
      ...Object.entries(counts).map(([k, v]) => ({ Field: `${k} records`, Value: v })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    wb.SheetNames = ["Summary", ...wb.SheetNames.filter((n) => n !== "Summary")];

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const ctx = await requestContext();
    await logActivity({
      employeeId: user.isEnvAdmin ? null : user.id,
      employeeName: user.name,
      employeeRole: user.role,
      action: `downloaded a database backup (${fromStr || "start"} → ${toStr || "now"})`,
      module: "reports",
      ...ctx,
    });

    const filename = `SOMART-backup_${fromStr || "all"}_to_${toStr || "now"}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/backup failed:", err);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
