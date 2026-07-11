// Where a customer came from. Client-safe (no mongoose imports).
export const MARKETING_SOURCES = ["walk-in", "facebook", "tiktok", "no-ads"] as const;

export type MarketingSource = (typeof MARKETING_SOURCES)[number];

export const SOURCE_LABELS: Record<MarketingSource, string> = {
  "walk-in": "Walk-in",
  facebook: "Facebook",
  tiktok: "TikTok",
  "no-ads": "No Ads",
};
