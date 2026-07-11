import Link from "next/link";
import type { ProductDoc } from "@/models/Product";
import {
  GlassesIcon,
  SparklesIcon,
  SunglassesIcon,
  WatchIcon,
} from "@/components/icons";

export type ProductJSON = Omit<
  ProductDoc,
  "_id" | "createdAt" | "updatedAt" | "specs"
> & {
  _id: string;
  specs?: { label?: string; value?: string }[];
};

const categoryIcons: Record<string, typeof GlassesIcon> = {
  eyeglasses: GlassesIcon,
  sunglasses: SunglassesIcon,
  watches: WatchIcon,
  accessories: SparklesIcon,
};

export function finalPrice(p: { price: number; discountPercent?: number }) {
  const pct = p.discountPercent ?? 0;
  return pct > 0 ? Math.round(p.price * (100 - pct)) / 100 : p.price;
}

export default function ProductCard({
  product,
  index = 0,
}: {
  product: ProductJSON;
  index?: number;
}) {
  const Icon = categoryIcons[product.category] ?? SparklesIcon;
  const onSale = (product.discountPercent ?? 0) > 0;
  const price = finalPrice(product);

  return (
    <Link
      href={`/products/${product.slug}`}
      style={{ animationDelay: `${Math.min(index, 7) * 80}ms` }}
      className="group animate-fade-up cursor-pointer overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-gold/60 hover:shadow-xl hover:shadow-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold dark:hover:shadow-black/40"
    >
      <div className="relative overflow-hidden">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 text-stone-400 dark:from-stone-900 dark:to-stone-800 dark:text-stone-600">
            <Icon className="h-16 w-16 transition-transform duration-500 group-hover:scale-110" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {onSale && (
            <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              −{product.discountPercent}%
            </span>
          )}
          {product.featured && (
            <span className="rounded-full bg-gold-bright px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
              Featured
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
          {product.brand}
        </p>
        <h3 className="mt-1 text-lg font-semibold transition-colors duration-200 group-hover:text-gold">
          {product.name}
        </h3>
        <div className="mt-2 flex items-center justify-between">
          <p className="font-semibold text-gold">
            ${price.toFixed(2)}
            {onSale && (
              <span className="ml-2 text-sm font-normal text-muted line-through">
                ${product.price.toFixed(2)}
              </span>
            )}
          </p>
          {(product.stockQty ?? 0) === 0 && (
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
              Out of stock
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
