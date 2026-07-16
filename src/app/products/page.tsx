import type { Metadata } from "next";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import ProductCard, { type ProductJSON } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
};

const PAGE_SIZE = 12;

const categories = [
  { value: "", label: "All" },
  { value: "eyeglasses", label: "Eyeglasses" },
  { value: "sunglasses", label: "Sunglasses" },
  { value: "watches", label: "Watches" },
  { value: "accessories", label: "Accessories" },
];

const sorts = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "best-selling", label: "Best Selling" },
];

type Search = {
  category?: string;
  filter?: string;
  q?: string;
  sort?: string;
  page?: string;
};

async function getProducts(params: Search) {
  try {
    await connectDB();
    // Only public (visible) products; hidden ones stay admin-only.
    const filter: Record<string, unknown> = { visible: { $ne: false } };
    if (params.category) filter.category = params.category;
    if (params.filter === "sale") filter.discountPercent = { $gt: 0 };
    if (params.filter === "new") {
      filter.createdAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }
    if (params.q) {
      filter.$or = [
        { name: { $regex: params.q, $options: "i" } },
        { brand: { $regex: params.q, $options: "i" } },
      ];
    }

    const sort: Record<string, 1 | -1> =
      params.sort === "price-asc"
        ? { price: 1 }
        : params.sort === "price-desc"
          ? { price: -1 }
          : params.sort === "best-selling"
            ? { soldCount: -1 }
            : { createdAt: -1 };

    const page = Math.max(1, Number(params.page) || 1);
    const [products, count] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Product.countDocuments(filter),
    ]);
    return {
      products: JSON.parse(JSON.stringify(products)) as ProductJSON[],
      count,
      page,
      pages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
    };
  } catch (err) {
    console.error("Failed to load products:", err);
    return { products: [], count: 0, page: 1, pages: 1 };
  }
}

function buildQuery(params: Search, patch: Partial<Search>) {
  const merged = { ...params, ...patch };
  const query = new URLSearchParams();
  if (merged.category) query.set("category", merged.category);
  if (merged.filter) query.set("filter", merged.filter);
  if (merged.q) query.set("q", merged.q);
  if (merged.sort && merged.sort !== "newest") query.set("sort", merged.sort);
  if (merged.page && merged.page !== "1") query.set("page", merged.page);
  const qs = query.toString();
  return qs ? `/products?${qs}` : "/products";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const { products, count, page, pages } = await getProducts(params);
  const activeCategory = params.category ?? "";

  const heading =
    params.filter === "sale"
      ? "On Sale"
      : params.filter === "new"
        ? "New Collection"
        : "Shop SOMART";

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <p className="animate-fade-up text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
        The Collection
      </p>
      <h1 className="animate-fade-up delay-100 mt-1 text-4xl font-semibold">{heading}</h1>
      <p className="animate-fade-up delay-200 mt-2 leading-relaxed text-muted">
        {count} piece{count === 1 ? "" : "s"} · designer eyewear, watches and accessories.
      </p>

      <div className="animate-fade-up delay-300 mt-7 flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <Link
            key={c.label}
            href={buildQuery(params, { category: c.value, page: "1" })}
            className={`cursor-pointer rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
              c.value === activeCategory
                ? "bg-foreground text-background"
                : "border border-line bg-surface text-muted hover:border-gold hover:text-gold"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="animate-fade-up delay-400 mt-4 flex flex-wrap items-center justify-between gap-3">
        <form action="/products" method="get" className="flex gap-2">
          {params.category && <input type="hidden" name="category" value={params.category} />}
          {params.filter && <input type="hidden" name="filter" value={params.filter} />}
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-56 rounded-full border border-line bg-surface px-5 py-2.5 text-sm transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-full border border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 font-semibold uppercase tracking-wider text-muted">Sort:</span>
          {sorts.map((s) => (
            <Link
              key={s.value}
              href={buildQuery(params, { sort: s.value, page: "1" })}
              className={`cursor-pointer rounded-full px-3 py-1.5 font-semibold transition-colors duration-200 ${
                (params.sort ?? "newest") === s.value
                  ? "bg-gold-bright/20 text-gold"
                  : "text-muted hover:text-gold"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-16 rounded-3xl border border-dashed border-line p-12 text-center text-muted">
          <p className="font-semibold">No products found.</p>
          <p className="mt-1 text-sm">Try a different search or category.</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product, i) => (
            <ProductCard key={product._id} product={product} index={i} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-12 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildQuery(params, { page: String(p) })}
              aria-current={p === page ? "page" : undefined}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 ${
                p === page
                  ? "bg-foreground text-background"
                  : "border border-line text-muted hover:border-gold hover:text-gold"
              }`}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
