// Shared shapes for the AI Business Intelligence report. The engine produces a
// BIReport; the UI and the PDF both render from it.

export type BIKpi = { label: string; value: string; hint?: string };
export type BIBar = { label: string; value: number; display?: string };
export type BITable = { columns: string[]; rows: (string | number)[][] };
export type BITone = "positive" | "negative" | "neutral" | "opportunity" | "risk";
export type BIInsight = { title: string; detail: string; tone: BITone };
export type BIRec = { priority: "High" | "Medium" | "Low"; action: string; reason: string };

export type BIHealth = {
  score: number; // 0..100
  grade: string; // Excellent / Good / Fair / Needs attention
  drivers: { label: string; score: number; note: string }[];
};

export type BIReport = {
  meta: {
    company: string;
    periodLabel: string;
    from: string;
    to: string;
    generatedAt: string;
    hasComparison: boolean;
    prevPeriodLabel: string;
    dataPoints: number; // number of sales analysed
  };
  health: BIHealth;
  executive: { kpis: BIKpi[]; narrative: string[] };
  keyInsights: BIInsight[];
  sales: { kpis: BIKpi[]; byDay: BIBar[]; byPayment: BIBar[]; narrative: string[] };
  customers: { kpis: BIKpi[]; byType: BIBar[]; byCity: BIBar[]; top: BITable; narrative: string[] };
  products: {
    topByRevenue: BITable;
    categories: BIBar[];
    brands: BIBar[];
    basket: { pair: string; count: number; note: string }[];
    fastMovers: BITable;
    slowMovers: BITable;
    narrative: string[];
  };
  shopTime: { byHour: BIBar[]; byWeekday: BIBar[]; peakShift: string; peakHour: string; peakDay: string; narrative: string[] };
  marketing: { byChannel: BITable; narrative: string[] };
  inventory: { kpis: BIKpi[]; restock: BITable; narrative: string[] };
  freight: { kpis: BIKpi[]; byType: BITable; forwarders: BITable; narrative: string[] };
  financial: { kpis: BIKpi[]; expensesByCategory: BIBar[]; narrative: string[] };
  trends: { kpis: BIKpi[]; narrative: string[] };
  opportunities: BIInsight[];
  risks: BIInsight[];
  forecast: { kpis: BIKpi[]; narrative: string[] } | null;
  recommendations: BIRec[];
};
