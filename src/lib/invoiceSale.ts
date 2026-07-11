import type { HydratedDocument } from "mongoose";
import { Invoice, type InvoiceDoc } from "@/models/Invoice";
import { Product } from "@/models/Product";
import { Sale, type SaleDoc } from "@/models/Sale";
import { nextNumber } from "@/lib/numbering";
import { computeProfit, round2 } from "@/lib/profit";

type InvoiceDocument = HydratedDocument<InvoiceDoc>;
type SaleDocument = HydratedDocument<SaleDoc>;

// Invoice ⇄ Sale lifecycle:
//   Invoice paid            → linked Sale is "completed" and stock is deducted.
//   Invoice draft/unpaid/…  → linked Sale becomes "pending" and stock is restored.
// The sale record survives status flips, so inventory stays accurate no matter
// how many times the invoice status changes.

async function deductStock(sale: SaleDocument) {
  for (const item of sale.items) {
    if (!item.productId) continue;
    const product = await Product.findById(item.productId);
    if (product) {
      product.stockQty = Math.max(0, (product.stockQty ?? 0) - item.qty);
      product.soldCount = (product.soldCount ?? 0) + item.qty;
      if (product.stockQty <= 0) product.inStock = false;
      await product.save();
    }
  }
}

async function restoreStock(sale: SaleDocument) {
  for (const item of sale.items) {
    if (!item.productId) continue;
    const product = await Product.findById(item.productId);
    if (product) {
      product.stockQty = (product.stockQty ?? 0) + item.qty;
      product.soldCount = Math.max(0, (product.soldCount ?? 0) - item.qty);
      if (product.stockQty > 0) product.inStock = true;
      await product.save();
    }
  }
}

export async function applyInvoicePaid(invoice: InvoiceDocument) {
  // Re-payment of an invoice whose sale is pending: complete it again.
  if (invoice.saleId) {
    const sale = await Sale.findById(invoice.saleId);
    if (sale && sale.status === "pending") {
      await deductStock(sale);
      sale.status = "completed";
      await sale.save();
    }
    return;
  }

  // First payment: back-fill the profit snapshot for legacy invoices created
  // before profit tracking, then build the Sale by INHERITING that snapshot
  // (the Sales module never recalculates profit — it reads invoice data).
  await ensureInvoiceProfitSnapshot(invoice);

  const saleItems = invoice.items.map((item) => ({
    productId: item.productId ?? null,
    name: item.name,
    price: item.price,
    qty: item.qty,
    costPrice: item.costPrice ?? 0,
    profitAmount: item.profitAmount ?? 0,
    markupPercent: item.markupPercent ?? 0,
    marginPercent: item.marginPercent ?? 0,
    category: item.category ?? "",
    brand: item.brand ?? "",
  }));

  const sale = await Sale.create({
    number: await nextNumber(Sale, "SAL"),
    items: saleItems,
    customerId: invoice.customerId,
    customerName: invoice.customerName || "Walk-in",
    subtotal: invoice.subtotal,
    discount: invoice.discount ?? 0,
    total: invoice.total,
    totalCost: invoice.totalCost ?? 0,
    profit: invoice.profit ?? 0,
    paymentMethod: "other",
    status: "completed",
    source: invoice.source ?? "walk-in",
    customerType: invoice.customerType ?? "retail",
    invoiceId: invoice._id,
    note: `Payment of invoice ${invoice.number}`,
  });
  await deductStock(sale);

  invoice.saleId = sale._id;
  await invoice.save();
}

// Legacy invoices (created before profit tracking) have no cost snapshot.
// Fill it in once from current product costs so the sale inherits real numbers.
async function ensureInvoiceProfitSnapshot(invoice: InvoiceDocument) {
  const alreadyHasSnapshot =
    (invoice.totalCost ?? 0) > 0 ||
    invoice.items.some((i) => (i.costPrice ?? 0) > 0 || (i.profitAmount ?? 0) > 0);
  if (alreadyHasSnapshot) return;

  let totalCost = 0;
  let grossProfit = 0;
  for (const item of invoice.items) {
    let costPrice = 0;
    let category = item.category ?? "";
    let brand = item.brand ?? "";
    if (item.productId) {
      const product = await Product.findById(item.productId)
        .select("costPrice category brand")
        .lean();
      if (product) {
        costPrice = Math.max(0, product.costPrice ?? 0);
        category = product.category ?? "";
        brand = product.brand ?? "";
      }
    }
    const { profitAmount, markupPercent, marginPercent } = computeProfit(
      item.price,
      costPrice
    );
    item.costPrice = costPrice;
    item.profitAmount = profitAmount;
    item.markupPercent = markupPercent;
    item.marginPercent = marginPercent;
    item.category = category;
    item.brand = brand;
    totalCost += costPrice * item.qty;
    grossProfit += profitAmount * item.qty;
  }
  invoice.totalCost = round2(totalCost);
  invoice.profit = round2(grossProfit - (invoice.discount ?? 0));
}

export async function revertInvoicePaid(invoice: InvoiceDocument) {
  if (!invoice.saleId) return;
  const sale = await Sale.findById(invoice.saleId);
  if (sale && sale.status === "completed") {
    await restoreStock(sale);
    sale.status = "pending";
    await sale.save();
  }
}

// Deleting an invoice removes its linked sale entirely (restoring stock first
// if the sale was completed).
export async function removeInvoiceSale(invoice: InvoiceDocument) {
  if (!invoice.saleId) return;
  const sale = await Sale.findById(invoice.saleId);
  if (sale) {
    if (sale.status === "completed") await restoreStock(sale);
    await sale.deleteOne();
  }
  invoice.saleId = null;
}

// Keep the invoice consistent when its linked sale is deleted from Sales
// (stock restoration is handled by the sales DELETE route).
export async function detachSaleFromInvoice(invoiceId: unknown) {
  if (!invoiceId) return;
  await Invoice.findByIdAndUpdate(invoiceId, {
    $set: { saleId: null, status: "unpaid" },
  });
}
