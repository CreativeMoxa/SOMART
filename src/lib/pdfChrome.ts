"use client";

import type { jsPDF } from "jspdf";

// Shared visual language for every generated PDF (invoices, quotations, and
// reports) so they all match the branded template: soft grey decorative
// corners, a tagline + logo header, and a centered thank-you footer.

// Brand document palette — deep navy ink with soft lavender accents. (Names
// kept for compatibility; the decor/band greys are now lavender.)
export const DECOR_GREY: [number, number, number] = [235, 233, 251]; // #ebe9fb
export const BAND_GREY: [number, number, number] = [238, 240, 252]; // #eef0fc
export const INK: [number, number, number] = [22, 34, 92]; // #16225c navy
export const MUTED: [number, number, number] = [91, 100, 120]; // #5b6478

type LoadedImage = { dataUrl: string; width: number; height: number };

// Draw an image file to a canvas and cache it as a PNG data URL. Time-boxed so
// a missing/slow asset never hangs the export. `invert` flips colors (used for
// the white-on-black wordmark so it reads on a white page).
const imageCache = new Map<string, LoadedImage | null>();
export async function loadImageData(
  src: string,
  invert = false
): Promise<LoadedImage | null> {
  const key = `${src}|${invert}`;
  if (imageCache.has(key)) return imageCache.get(key) ?? null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const timer = setTimeout(() => reject(new Error("image timeout")), 3000);
      el.onload = () => {
        clearTimeout(timer);
        resolve(el);
      };
      el.onerror = (e) => {
        clearTimeout(timer);
        reject(e);
      };
      el.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      imageCache.set(key, null);
      return null;
    }
    ctx.drawImage(img, 0, 0);
    if (invert) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.data.length; i += 4) {
        data.data[i] = 255 - data.data[i];
        data.data[i + 1] = 255 - data.data[i + 1];
        data.data[i + 2] = 255 - data.data[i + 2];
      }
      ctx.putImageData(data, 0, 0);
    }
    const result: LoadedImage = {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
    imageCache.set(key, result);
    return result;
  } catch {
    imageCache.set(key, null);
    return null;
  }
}

// Soft grey organic curves in the top-right and bottom corners. Drawn first so
// all content paints on top.
export function drawDecor(pdf: jsPDF, pageWidth: number, pageHeight: number) {
  pdf.setFillColor(...DECOR_GREY);
  // Top-right sweep.
  pdf.ellipse(pageWidth - 80, -6, 330, 150, "F");
  // Bottom-left and bottom-right corners.
  pdf.ellipse(10, pageHeight + 10, 150, 85, "F");
  pdf.ellipse(pageWidth - 20, pageHeight + 24, 190, 105, "F");
}

// A small navy circular badge with a white glyph (location / phone / website),
// rendered as an SVG data URL so it can be rasterized and placed in the PDF —
// matching the icons on the HTML print document.
type ContactIcon = "location" | "phone" | "website";
function contactBadgeSvg(kind: ContactIcon): string {
  const glyph =
    kind === "location"
      ? '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'
      : kind === "phone"
      ? '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>'
      : '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.7 2.7 4 6 4 9.5s-1.3 6.8-4 9.5c-2.7-2.7-4-6-4-9.5s1.3-6.8 4-9.5Z"/>';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">' +
    '<circle cx="12" cy="12" r="12" fill="#16225c"/>' +
    '<g transform="translate(12 12) scale(0.52) translate(-12 -12)" fill="none" stroke="#fff" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    glyph +
    "</g></svg>";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// Header band. Two layouts share this helper:
//  • Reports (default): tagline top-left, logo + single location line top-right.
//  • Branded invoices/quotations (`contactStack`): logo centered at the top of a
//    locked group in the top-right corner, with address / phone / website lines
//    stacked beneath it, each led by a navy circular icon.
// Returns the y baseline where page content can safely begin.
export async function drawHeader(
  pdf: jsPDF,
  opts: {
    pageWidth: number;
    margin: number;
    tagline?: string;
    location?: string;
    phone?: string;
    website?: string;
    contactStack?: boolean;
  }
): Promise<number> {
  const { pageWidth, margin, tagline, location, phone, website, contactStack } =
    opts;

  if (tagline) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text(tagline, margin, 46);
  }

  // Navy logo on a transparent background (matches the branded documents).
  const mark = await loadImageData("/logo-mark-navy.png");
  const size = 42;

  if (contactStack) {
    // Build the locked contact group, then center the logo above it.
    const lines: { text: string; kind: ContactIcon }[] = [];
    if (location) lines.push({ text: location, kind: "location" });
    if (phone) lines.push({ text: phone, kind: "phone" });
    if (website) lines.push({ text: website, kind: "website" });

    const iconSize = 12;
    const gap = 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    let maxW = size; // never narrower than the logo
    for (const l of lines) {
      maxW = Math.max(maxW, iconSize + gap + pdf.getTextWidth(l.text));
    }
    const rightEdge = pageWidth - margin;
    const centerX = rightEdge - maxW / 2;

    const logoY = 26;
    if (mark) pdf.addImage(mark.dataUrl, "PNG", centerX - size / 2, logoY, size, size);

    let ly = logoY + size + 16; // baseline of the first contact line
    for (const l of lines) {
      const lineW = iconSize + gap + pdf.getTextWidth(l.text);
      const startX = centerX - lineW / 2;
      const badge = await loadImageData(contactBadgeSvg(l.kind));
      if (badge) {
        pdf.addImage(badge.dataUrl, "PNG", startX, ly - iconSize + 2.5, iconSize, iconSize);
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...MUTED);
      pdf.text(l.text, startX + iconSize + gap, ly);
      ly += 16;
    }
    return Math.max(118, ly);
  }

  // Default (report) layout: logo top-right, single location line beneath it.
  const logoX = pageWidth - margin - size;
  if (mark) {
    pdf.addImage(mark.dataUrl, "PNG", logoX, 30, size, size);
  }
  if (location) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text(location, pageWidth - margin, 30 + size + 14, { align: "right" });
  }

  return 118;
}

// Centered thank-you footer + page number, drawn on every page.
export function drawFooter(
  pdf: jsPDF,
  opts: {
    pageWidth: number;
    pageHeight: number;
    footer?: string;
    pageNumber: number;
    pageCount: number;
  }
) {
  const { pageWidth, pageHeight, footer, pageNumber, pageCount } = opts;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...MUTED);
  if (footer) {
    pdf.text(footer, pageWidth / 2, pageHeight - 46, { align: "center" });
  }
  pdf.setFontSize(8.5);
  pdf.setTextColor(150);
  pdf.text(`Page ${pageNumber} / ${pageCount}`, pageWidth / 2, pageHeight - 32, {
    align: "center",
  });
}
