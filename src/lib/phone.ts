// Reduce a phone number to its comparable digits so search matches regardless
// of formatting: drop spaces/dashes/(), the Somalia country code (252) and any
// leading local-trunk zero. "634401054", "252 63 4401054" and "0634401054" all
// become "634401054". Client-safe (no imports).
export function phoneDigits(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("252")) d = d.slice(3);
  d = d.replace(/^0+/, "");
  return d;
}

// Escape a string for safe use inside a RegExp.
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
