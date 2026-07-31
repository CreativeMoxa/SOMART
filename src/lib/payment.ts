// Payment methods — client-safe (no mongoose imports). Single source of truth
// for the model enum, the sale/invoice forms and any display label.
export const PAYMENT_METHODS = [
  "zaad",
  "edahab",
  "premier-wallet",
  "ebirr",
  "bank",
  "cash",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  zaad: "ZAAD",
  edahab: "EDAHAB",
  "premier-wallet": "PREMIER WALLET",
  ebirr: "EBIRR",
  bank: "BANK",
  cash: "CASH",
};

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "cash";

// Map any stored value (including the old cash/card/mobile-money/bank-transfer/
// other set) onto a current method, so historical records display and validate
// correctly. Old "mobile money" is treated as ZAAD.
export function normalizePaymentMethod(value: unknown): PaymentMethod {
  const v = String(value ?? "").trim().toLowerCase();
  switch (v) {
    case "zaad":
      return "zaad";
    case "edahab":
    case "e-dahab":
    case "e dahab":
      return "edahab";
    case "premier-wallet":
    case "premier wallet":
    case "premierwallet":
    case "premier":
      return "premier-wallet";
    case "ebirr":
    case "e-birr":
    case "e birr":
      return "ebirr";
    case "bank":
    case "bank-transfer":
    case "banktransfer":
    case "transfer":
    case "card": // legacy card payments were bank instruments
      return "bank";
    case "mobile-money":
    case "mobile money":
    case "mobilemoney":
    case "mobile":
      return "zaad";
    case "cash":
    case "other":
    default:
      return "cash";
  }
}

export function paymentMethodLabel(value: unknown): string {
  return PAYMENT_METHOD_LABELS[normalizePaymentMethod(value)];
}
