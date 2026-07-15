import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { getSettings } from "@/models/Setting";
import { DEFAULT_TEMPLATES, renderTemplate } from "@/lib/templates";
import ProductCard, { type ProductJSON } from "@/components/ProductCard";
import Gallery from "./Gallery";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  GlassesIcon,
  SparklesIcon,
  SunglassesIcon,
  WatchIcon,
  WhatsAppIcon,
} from "@/components/icons";

// Cache each product page; refresh in the background at most once a minute.
export const revalidate = 60;

// Render product pages on demand and cache them (ISR).
export function generateStaticParams() {
  return [];
}

const categoryIcons: Record<string, typeof GlassesIcon> = {
  eyeglasses: GlassesIcon,
  sunglasses: SunglassesIcon,
  watches: WatchIcon,
  accessories: SparklesIcon,
};

const categoryLabels: Record<string, string> = {
  eyeglasses: "Eyeglasses",
  sunglasses: "Sunglasses",
  watches: "Watches",
  accessories: "Accessories",
};

// cache() dedupes the two calls per render (generateMetadata + the page itself).
const getData = cache(async function getData(slug: string) {
  try {
    await connectDB();
    const product = await Product.findOne({ slug }).lean();
    if (!product) return null;
    const [related, settings] = await Promise.all([
      Product.find({ category: product.category, slug: { $ne: slug } })
        .limit(4)
        .lean(),
      getSettings(),
    ]);
    return {
      product: JSON.parse(JSON.stringify(product)) as ProductJSON,
      related: JSON.parse(JSON.stringify(related)) as ProductJSON[],
      whatsapp: settings.whatsappNumber?.replace(/[^0-9]/g, "") ?? "",
      businessName: settings.companyName || "SOMART",
      whatsappTemplate:
        settings.templateWhatsappProduct || DEFAULT_TEMPLATES.whatsappProduct,
    };
  } catch (err) {
    console.error("Failed to load product:", err);
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getData(slug);
  return { title: data ? data.product.name : "Product" };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();

  const { product, related, whatsapp, businessName, whatsappTemplate } = data;
  const Icon = categoryIcons[product.category] ?? SparklesIcon;
  const onSale = (product.discountPercent ?? 0) > 0;
  const inStock = (product.stockQty ?? 0) > 0;
  const images =
    product.images && product.images.length > 0
      ? product.images
      : product.imageUrl
        ? [product.imageUrl]
        : [];

  const waText = encodeURIComponent(
    renderTemplate(whatsappTemplate, {
      business_name: businessName,
      product_name: product.name,
      brand: product.brand,
      // Prices are shared over WhatsApp, not shown on the site.
      price: "",
    })
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <nav className="animate-fade-in text-xs font-semibold uppercase tracking-[0.15em] text-muted">
        <Link href="/products" className="cursor-pointer transition-colors duration-200 hover:text-gold">
          Shop
        </Link>{" "}
        /{" "}
        <Link
          href={`/products?category=${product.category}`}
          className="cursor-pointer transition-colors duration-200 hover:text-gold"
        >
          {categoryLabels[product.category] ?? product.category}
        </Link>{" "}
        / <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div className="animate-fade-up">
          {images.length > 0 ? (
            <Gallery images={images} name={product.name} />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-3xl border border-line bg-gradient-to-br from-stone-100 to-stone-200 text-stone-400 dark:from-stone-900 dark:to-stone-800 dark:text-stone-600">
              <Icon className="h-28 w-28" />
            </div>
          )}
        </div>

        <div className="animate-fade-up delay-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {product.brand}
          </p>
          <h1 className="mt-2 text-4xl font-semibold">{product.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-2 text-sm font-semibold text-gold">
              <WhatsAppIcon className="h-4 w-4" /> Ask for price on WhatsApp
            </span>
            {onSale && (
              <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
                On Sale
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
            {inStock ? (
              <>
                <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                <span className="text-emerald-500">
                  In stock{(product.stockQty ?? 0) <= 5 ? ` — only ${product.stockQty} left` : ""}
                </span>
              </>
            ) : (
              <span className="rounded-full border border-line px-3 py-1 text-muted">
                Currently out of stock
              </span>
            )}
          </div>

          <p className="mt-6 leading-relaxed text-muted">
            {product.description || "No description available yet."}
          </p>

          <dl className="mt-7 space-y-2.5 text-sm">
            {product.material && (
              <div className="flex gap-2">
                <dt className="font-semibold">Material:</dt>
                <dd className="text-muted">{product.material}</dd>
              </div>
            )}
            {(product.colors ?? []).length > 0 && (
              <div className="flex gap-2">
                <dt className="font-semibold">Colors:</dt>
                <dd className="text-muted">{product.colors.join(", ")}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="font-semibold">Fit:</dt>
              <dd className="capitalize text-muted">{product.gender}</dd>
            </div>
          </dl>

          {(product.specs ?? []).length > 0 && (
            <div className="mt-7">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em]">
                Specifications
              </h2>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {product.specs!.map((spec, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="py-2 pr-4 font-semibold">{spec.label}</td>
                      <td className="py-2 text-muted">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-9 flex flex-wrap gap-3">
            {whatsapp && inStock && (
              <a
                href={`https://wa.me/${whatsapp}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex cursor-pointer items-center gap-2 rounded-full bg-[#25D366] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-white transition-transform duration-200 hover:scale-[1.03]"
              >
                <WhatsAppIcon className="h-5 w-5" /> Order on WhatsApp
              </a>
            )}
            <Link
              href="/products"
              className="group flex cursor-pointer items-center gap-2 rounded-full border border-line px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] transition-colors duration-200 hover:border-gold hover:text-gold"
            >
              Continue Shopping
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl font-semibold">You may also like</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard key={p._id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
