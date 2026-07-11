"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ProductJSON } from "@/components/ProductCard";
import { useSelection, BulkBar, checkboxClass } from "@/components/admin/TableTools";
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from "@/components/icons";

const emptyForm = {
  name: "",
  slug: "",
  brand: "",
  category: "sunglasses",
  price: "",
  costPrice: "",
  discountPercent: "",
  stockQty: "",
  description: "",
  imageUrl: "",
  images: [] as string[],
  colors: "",
  material: "",
  specs: "",
  gender: "unisex",
  featured: false,
};

type FormState = typeof emptyForm;

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toForm(p: ProductJSON): FormState {
  return {
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    category: p.category,
    price: String(p.price),
    costPrice: String(p.costPrice ?? 0),
    discountPercent: String(p.discountPercent ?? 0),
    stockQty: String(p.stockQty ?? 0),
    description: p.description ?? "",
    imageUrl: p.imageUrl ?? "",
    images: p.images ?? [],
    colors: (p.colors ?? []).join(", "),
    material: p.material ?? "",
    specs: (p.specs ?? []).map((s) => `${s.label}: ${s.value}`).join("\n"),
    gender: p.gender ?? "unisex",
    featured: p.featured,
  };
}

export default function ProductsManager() {
  const [products, setProducts] = useState<ProductJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editing: null = closed, "" = creating new, slug = editing existing
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { selected, toggle, toggleAll, clear } = useSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function handleBulkDelete() {
    if (
      !confirm(
        `Delete ${selected.size} product${selected.size === 1 ? "" : "s"}? This cannot be undone.`
      )
    )
      return;
    setBulkDeleting(true);
    setError(null);
    try {
      for (const slug of selected) {
        const res = await fetch(`/api/products/${slug}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      }
      clear();
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
      setLoading(true);
      await load();
    } finally {
      setBulkDeleting(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      setProducts(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setForm(emptyForm);
    setEditing("");
    setError(null);
  }

  function openEdit(product: ProductJSON) {
    setForm(toForm(product));
    setEditing(product.slug);
    setError(null);
  }

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
        setForm((f) => ({
          ...f,
          imageUrl: f.imageUrl || body.url,
          images: [...f.images, body.url],
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeImage(url: string) {
    setForm((f) => {
      const images = f.images.filter((i) => i !== url);
      return {
        ...f,
        images,
        imageUrl: f.imageUrl === url ? images[0] ?? "" : f.imageUrl,
      };
    });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const stockQty = Math.max(0, Math.floor(Number(form.stockQty) || 0));
    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      brand: form.brand,
      category: form.category,
      price: Number(form.price),
      costPrice: Math.max(0, Number(form.costPrice) || 0),
      discountPercent: Math.min(90, Math.max(0, Number(form.discountPercent) || 0)),
      stockQty,
      inStock: stockQty > 0,
      description: form.description,
      imageUrl: form.imageUrl,
      images: form.images,
      colors: form.colors.split(",").map((c) => c.trim()).filter(Boolean),
      material: form.material,
      specs: form.specs
        .split("\n")
        .map((line) => {
          const [label, ...rest] = line.split(":");
          return { label: label?.trim() ?? "", value: rest.join(":").trim() };
        })
        .filter((s) => s.label && s.value),
      gender: form.gender,
      featured: form.featured,
    };

    try {
      const isNew = editing === "";
      const res = await fetch(
        isNew ? "/api/products" : `/api/products/${editing}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: ProductJSON) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/products/${product.slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      setProducts((list) => list.filter((p) => p.slug !== product.slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function toggleFeatured(product: ProductJSON) {
    try {
      const res = await fetch(`/api/products/${product.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !product.featured }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
      setProducts((list) =>
        list.map((p) =>
          p.slug === product.slug ? { ...p, featured: !p.featured } : p
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Inventory
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-muted">
            {products.length} product{products.length === 1 ? "" : "s"} in the catalog
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
        >
          <PlusIcon className="h-4 w-4" /> New Product
        </button>
      </div>

      <BulkBar
        count={selected.size}
        onDelete={handleBulkDelete}
        onClear={clear}
        deleting={bulkDeleting}
      />

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-8 grid gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className={checkboxClass}
                    checked={products.length > 0 && products.every((p) => selected.has(p.slug))}
                    onChange={() => toggleAll(products.map((p) => p.slug))}
                  />
                </th>
                <th className="w-10 px-2 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Discount</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Sold</th>
                <th className="px-4 py-3 font-semibold">Featured</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, rowIndex) => (
                <tr
                  key={product._id}
                  className={`border-b border-line last:border-0 ${
                    selected.has(product.slug) ? "bg-gold/5" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${product.name}`}
                      className={checkboxClass}
                      checked={selected.has(product.slug)}
                      onChange={() => toggle(product.slug)}
                    />
                  </td>
                  <td className="px-2 py-3 text-xs text-muted">{rowIndex + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-11 w-11 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-lg bg-surface" />
                      )}
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-muted">{product.brand}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted">{product.category}</td>
                  <td className="px-4 py-3 font-semibold text-gold">
                    ${product.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {(product.discountPercent ?? 0) > 0
                      ? `${product.discountPercent}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        (product.stockQty ?? 0) === 0
                          ? "bg-red-500/15 text-red-500"
                          : (product.stockQty ?? 0) <= 5
                            ? "bg-amber-500/15 text-amber-500"
                            : "bg-emerald-500/15 text-emerald-500"
                      }`}
                    >
                      {product.stockQty ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{product.soldCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleFeatured(product)}
                      className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 ${
                        product.featured
                          ? "bg-gold-bright/20 text-gold"
                          : "bg-surface text-muted"
                      }`}
                    >
                      {product.featured ? "Featured" : "—"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        aria-label={`Edit ${product.name}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-gold"
                      >
                        <PencilIcon className="h-4.5 w-4.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product)}
                        aria-label={`Delete ${product.name}`}
                        className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
                      >
                        <TrashIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted">
                    No products yet — add your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={editing === "" ? "New product" : "Edit product"}
        >
          <form
            onSubmit={handleSave}
            className="animate-fade-up my-8 w-full max-w-2xl rounded-3xl border border-line bg-background p-6 sm:p-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                {editing === "" ? "New Product" : "Edit Product"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p-name" className="text-sm font-semibold">Name</label>
                <input
                  id="p-name"
                  required
                  value={form.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (editing === "") set("slug", slugify(e.target.value));
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="p-brand" className="text-sm font-semibold">Brand</label>
                <input
                  id="p-brand"
                  required
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="p-category" className="text-sm font-semibold">Category</label>
                <select
                  id="p-category"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className={inputClass}
                >
                  <option value="eyeglasses">Eyeglasses</option>
                  <option value="sunglasses">Sunglasses</option>
                  <option value="watches">Watches</option>
                  <option value="accessories">Accessories</option>
                </select>
              </div>
              <div>
                <label htmlFor="p-gender" className="text-sm font-semibold">Fit</label>
                <select
                  id="p-gender"
                  value={form.gender}
                  onChange={(e) => set("gender", e.target.value)}
                  className={inputClass}
                >
                  <option value="unisex">Unisex</option>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="kids">Kids</option>
                </select>
              </div>
              <div>
                <label htmlFor="p-price" className="text-sm font-semibold">Selling Price ($)</label>
                <input
                  id="p-price"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="p-cost" className="text-sm font-semibold">
                  Cost Price ($) <span className="font-normal text-muted">(for profit)</span>
                </label>
                <input
                  id="p-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => set("costPrice", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="p-discount" className="text-sm font-semibold">Discount (%)</label>
                <input
                  id="p-discount"
                  type="number"
                  min="0"
                  max="90"
                  value={form.discountPercent}
                  onChange={(e) => set("discountPercent", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="p-stock" className="text-sm font-semibold">Stock Quantity</label>
                <input
                  id="p-stock"
                  type="number"
                  min="0"
                  value={form.stockQty}
                  onChange={(e) => set("stockQty", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="p-material" className="text-sm font-semibold">Material</label>
                <input
                  id="p-material"
                  value={form.material}
                  onChange={(e) => set("material", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="p-colors" className="text-sm font-semibold">
                  Colors <span className="font-normal text-muted">(comma-separated)</span>
                </label>
                <input
                  id="p-colors"
                  value={form.colors}
                  onChange={(e) => set("colors", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="p-slug" className="text-sm font-semibold">Slug (URL)</label>
              <input
                id="p-slug"
                required
                value={form.slug}
                onChange={(e) => set("slug", slugify(e.target.value))}
                className={inputClass}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="p-desc" className="text-sm font-semibold">Description</label>
              <textarea
                id="p-desc"
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="p-specs" className="text-sm font-semibold">
                Specifications{" "}
                <span className="font-normal text-muted">(one per line, e.g. Lens Width: 52mm)</span>
              </label>
              <textarea
                id="p-specs"
                rows={3}
                value={form.specs}
                onChange={(e) => set("specs", e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="mt-4">
              <span className="text-sm font-semibold">Photo Gallery</span>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {form.images.map((url) => (
                  <div key={url} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className={`h-20 w-20 rounded-xl border-2 object-cover ${
                        form.imageUrl === url ? "border-gold" : "border-line"
                      }`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-xl bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => set("imageUrl", url)}
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
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line text-muted transition-colors duration-200 hover:border-gold hover:text-gold">
                  <UploadIcon className="h-6 w-6" />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files?.length) handleUpload(e.target.files);
                    }}
                  />
                </label>
              </div>
              {uploading && <p className="mt-2 text-xs text-gold">Uploading to Cloudinary…</p>}
            </div>

            <div className="mt-5">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-current"
                />
                Featured on homepage
              </label>
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="cursor-pointer rounded-full border border-line px-6 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-gold hover:text-gold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="cursor-pointer rounded-full bg-gold-bright px-7 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : editing === "" ? "Create Product" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
