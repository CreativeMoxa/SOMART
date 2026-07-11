// Customer type — a business classification of WHO the customer is, kept
// separate from marketing source (WHERE they came from). Client-safe.
export const CUSTOMER_TYPES = [
  "retail",
  "wholesale",
  "vip",
  "corporate",
  "online",
] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  retail: "Retail",
  wholesale: "Wholesale",
  vip: "VIP",
  corporate: "Corporate",
  online: "Online",
};

export const DEFAULT_CUSTOMER_TYPE: CustomerType = "retail";
