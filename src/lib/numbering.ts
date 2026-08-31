import type { Model } from "mongoose";

// Sequential document numbers like INV-000007 / QUO-000003 / SAL-000042.
// 6-digit padding so the numbering scales for years of use (up to 999,999).
export async function nextNumber(
  model: Model<never> | { countDocuments(): Promise<number> },
  prefix: string
) {
  const count = await (model as { countDocuments(): Promise<number> }).countDocuments();
  return `${prefix}-${String(count + 1).padStart(6, "0")}`;
}
