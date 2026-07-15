"use client";

import { useRef, useState, type FormEvent } from "react";
import { UploadIcon, XIcon } from "@/components/icons";

export type PickerProduct = {
  _id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  price: number;
  discountPercent?: number;
  imageUrl?: string;
  stockQty?: number;
  inStock?: boolean;
};

const CATEGORIES = ["eyeglasses", "sunglasses", "watches", "accessories"];

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function QuickAddProduct({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (product: PickerProduct) => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList) {
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const data = new FormData();
        data.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: data });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Upload failed");
        setImages((prev) => [...prev, body.url]);
        setImageUrl((prev) => prev || body.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeImage(url: string) {
    const next = images.filter((u) => u !== url);
    setImages(next);
    if (imageUrl === url) setImageUrl(next[0] ?? "");
  }

  async function createProduct(slug: string) {
    const qty = Math.max(0, Math.floor(Number(stockQty) || 0));
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        brand,
        category,
        price: Number(price),
        stockQty: qty,
        inStock: qty > 0,
        imageUrl: imageUrl || images[0] || "",
        images,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Save failed");
    return body as PickerProduct;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const slug = slugify(name);
      let product: PickerProduct;
      try {
        product = await createProduct(slug);
      } catch (err) {
        // Slug collision with an existing product: retry once with a unique suffix.
        if (err instanceof Error && /duplicate|E11000/i.test(err.message)) {
          product = await createProduct(`${slug}-${Date.now().toString(36)}`);
        } else {
          throw err;
        }
      }
      onCreated(product);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="New Product"
    >
      <form
        onSubmit={handleSave}
        className="animate-fade-up my-8 w-full max-w-md rounded-3xl border border-line bg-background p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">New Product</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="qp-name" className="text-sm font-semibold">Name</label>
            <input
              id="qp-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="qp-brand" className="text-sm font-semibold">Brand</label>
              <input
                id="qp-brand"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="qp-category" className="text-sm font-semibold">Category</label>
              <select
                id="qp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`${inputClass} cursor-pointer capitalize`}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="qp-price" className="text-sm font-semibold">Price ($)</label>
              <input
                id="qp-price"
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="qp-stock" className="text-sm font-semibold">Stock qty</label>
              <input
                id="qp-stock"
                type="number"
                min="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <span className="text-sm font-semibold">
              Photos{" "}
              <span className="font-normal text-muted">
                (add several — first is the main; great for colours/variations)
              </span>
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {images.map((url) => (
                <div key={url} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className={`h-16 w-16 rounded-xl border-2 object-cover ${
                      imageUrl === url ? "border-gold" : "border-line"
                    }`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-xl bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setImageUrl(url)}
                      title="Set as main photo"
                      className="cursor-pointer rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-black"
                    >
                      Main
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      title="Remove"
                      className="cursor-pointer rounded bg-red-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line text-muted transition-colors duration-200 hover:border-gold hover:text-gold">
                <UploadIcon className="h-6 w-6" />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    if (e.target.files?.length) handleUpload(e.target.files);
                  }}
                />
              </label>
            </div>
            {uploading && <p className="mt-2 text-xs text-gold">Uploading…</p>}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border border-line px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="cursor-pointer rounded-full bg-gold-bright px-6 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
