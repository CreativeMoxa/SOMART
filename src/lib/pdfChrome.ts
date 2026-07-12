"use client";

import type { jsPDF } from "jspdf";

// Shared visual language for every generated PDF (invoices, quotations, and
// reports) so they all match the branded template: soft grey decorative
// corners, a tagline + logo header, and a centered thank-you footer.

export const DECOR_GREY: [number, number, number] = [233, 233, 236];
export const BAND_GREY: [number, number, number] = [237, 237, 239];
export const INK: [number, number, number] = [17, 17, 17];
export const MUTED: [number, number, number] = [120, 120, 120];

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

// Header band: tagline (top-left) + square logo mark and location (top-right).
// Returns the y baseline where page content can safely begin.
export async function drawHeader(
  pdf: jsPDF,
  opts: {
    pageWidth: number;
    margin: number;
    tagline?: string;
    location?: string;
  }
): Promise<number> {
  const { pageWidth, margin, tagline, location } = opts;

  if (tagline) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text(tagline, margin, 46);
  }

  // Logo mark (white-on-black JPEG used as-is → the template's black tile).
  const mark = await loadImageData("/logo-mark.jpeg");
  const size = 42;
  const logoX = pageWidth - margin - size;
  if (mark) {
    pdf.addImage(mark.dataUrl, "JPEG", logoX, 30, size, size);
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
