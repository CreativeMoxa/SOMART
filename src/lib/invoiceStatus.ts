// Part-payment status logic for invoices — client-safe (no imports).
// Balance = total − amountPaid. Any payment below the total marks the invoice
// "partial"; paying the full total (or more) marks it "paid".
const round2 = (n: number) => Math.round(n * 100) / 100;

export type InvoiceStatusResult = { status: string; amountPaid: number; balance: number };

export function deriveInvoiceStatus(
  chosen: string,
  amountPaidInput: number,
  total: number
): InvoiceStatusResult {
  const paid = Math.max(0, Number(amountPaidInput) || 0);
  if (total > 0 && paid >= total) return { status: "paid", amountPaid: round2(total), balance: 0 };
  if (paid > 0) return { status: "partial", amountPaid: round2(paid), balance: round2(total - paid) };
  // No payment recorded — keep the chosen status, but never leave it paid/partial.
  const status = chosen === "partial" || chosen === "paid" ? "unpaid" : chosen;
  return { status, amountPaid: 0, balance: round2(total) };
}

export function invoiceBalance(total: number, amountPaid: number): number {
  return round2(Math.max(0, total - (amountPaid || 0)));
}
