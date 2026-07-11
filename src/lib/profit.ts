// Single source of truth for profit math, used by Product, Invoice lines,
// Sales, and Reports so the numbers are identical everywhere.
//
//   Profit Amount   = Selling Price − Cost Price
//   Markup %        = (Selling − Cost) / Cost   × 100
//   Profit Margin % = (Selling − Cost) / Selling × 100

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type ProfitMetrics = {
  profitAmount: number;
  markupPercent: number;
  marginPercent: number;
};

// Per-unit profit metrics from a selling price and a cost price.
export function computeProfit(sellingPrice: number, costPrice: number): ProfitMetrics {
  const selling = Math.max(0, Number(sellingPrice) || 0);
  const cost = Math.max(0, Number(costPrice) || 0);
  const profit = selling - cost;
  return {
    profitAmount: round2(profit),
    markupPercent: cost > 0 ? round2((profit / cost) * 100) : 0,
    marginPercent: selling > 0 ? round2((profit / selling) * 100) : 0,
  };
}

// Blended (business-wide) percentages from aggregate totals. Weighting by money
// is more meaningful than averaging per-line percentages.
export function blendedMarginPercent(revenue: number, profit: number): number {
  return revenue > 0 ? round2((profit / revenue) * 100) : 0;
}

export function blendedMarkupPercent(cost: number, profit: number): number {
  return cost > 0 ? round2((profit / cost) * 100) : 0;
}
