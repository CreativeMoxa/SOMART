import type { Model } from "mongoose";

// Sequential document numbers like INV-0007 / QUO-0003 / SAL-0042.
export async function nextNumber(
  model: Model<never> | { countDocuments(): Promise<number> },
  prefix: string
) {
  const count = await (model as { countDocuments(): Promise<number> }).countDocuments();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
