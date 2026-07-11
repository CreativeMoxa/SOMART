import Link from "next/link";
import Image from "next/image";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { getSettings } from "@/models/Setting";
import ProductCard, { type ProductJSON } from "@/components/ProductCard";
import {
  ArrowRightIcon,
  GlassesIcon,
  SparklesIcon,
  SunglassesIcon,
  WatchIcon,
  WhatsAppIcon,
} from "@/components/icons";

// Serve a cached page and refresh it in the background at most once a minute.
export const revalidate = 60;

const categories = [
  {
    href: "/products?category=eyeglasses",
    label: "Eyeglasses",
    tagline: "Frames that define you",
    Icon: GlassesIcon,
  },
  {
    href: "/products?category=sunglasses",
    label: "Sunglasses",
    tagline: "Shade with attitude",
    Icon: SunglassesIcon,
  },
  {
    href: "/products?category=watches",
    label: "Watches",
    tagline: "Time, worn beautifully",
    Icon: WatchIcon,
  },
  {
    href: "/products?category=accessories",
    label: "Accessories",
    tagline: "Details that finish the look",
    Icon: SparklesIcon,
  },
];

type HomeData = {
  featured: ProductJSON[];
  hotSale: ProductJSON[];
  newArrivals: ProductJSON[];
  bestSellers: ProductJSON[];
  whatsapp: string;
};

async function getHomeData(): Promise<HomeData> {
  try {
    await connectDB();
    const [featured, hotSale, newArrivals, bestSellers, settings] = await Promise.all([
      Product.find({ featured: true }).limit(4).lean(),
      Product.find({ discountPercent: { $gt: 0 } })
        .sort({ discountPercent: -1 })
        .limit(4)
        .lean(),
      Product.find().sort({ createdAt: -1 }).limit(4).lean(),
      Product.find({ soldCount: { $gt: 0 } }).sort({ soldCount: -1 }).limit(4).lean(),
      getSettings(),
    ]);
    return {
      featured: JSON.parse(JSON.stringify(featured)),
      hotSale: JSON.parse(JSON.stringify(hotSale)),
      newArrivals: JSON.parse(JSON.stringify(newArrivals)),
      bestSellers: JSON.parse(JSON.stringify(bestSellers)),
      whatsapp: settings.whatsappNumber?.replace(/[^0-9]/g, "") ?? "",
    };
  } catch (err) {
    console.error("Failed to load home data:", err);
    return { featured: [], hotSale: [], newArrivals: [], bestSellers: [], whatsapp: "" };
  }
}

function ProductRow({
  eyebrow,
  title,
  products,
  moreHref,
  eyebrowClass = "text-gold",
}: {
  eyebrow: string;
  title: string;
  products: ProductJSON[];
  moreHref: string;
  eyebrowClass?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="flex items-end justify-between">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.25em] ${eyebrowClass}`}>
            {eyebrow}
          </p>
          <h2 className="mt-1 text-3xl font-semibold">{title}</h2>
        </div>
        <Link
          href={moreHref}
          className="cursor-pointer text-xs font-semibold uppercase tracking-[0.15em] text-muted transition-colors duration-200 hover:text-gold"
        >
          View all →
        </Link>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product, i) => (
          <ProductCard key={product._id} product={product} index={i} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const { featured, hotSale, newArrivals, bestSellers, whatsapp } = await getHomeData();

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(202,138,4,0.14),transparent_55%)]"
        />
        <Image
          src="/logo-mark.jpeg"
          alt=""
          width={420}
          height={420}
          aria-hidden
          className="logo-adaptive animate-float pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2 opacity-[0.07] sm:-right-10"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-7 px-4 py-28 sm:px-6 sm:py-36">
          <p className="animate-fade-up rounded-full border border-gold/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Eyewear · Watches · Accessories
          </p>
          <h1 className="animate-fade-up delay-100 max-w-3xl text-5xl font-semibold leading-[1.05] sm:text-7xl">
            Style you can <span className="text-shimmer">see</span>.
          </h1>
          <p className="animate-fade-up delay-200 max-w-xl text-lg leading-relaxed text-muted">
            SOMART curates designer eyewear, watches and accessories for people
            who treat every day like a runway.
          </p>
          <div className="animate-fade-up delay-300 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="group flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-background transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Shop the Collection
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hi SOMART! I'd like to know more about your products.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex cursor-pointer items-center gap-2 rounded-full bg-[#25D366] px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-transform duration-200 hover:scale-[1.03]"
              >
                <WhatsAppIcon className="h-4.5 w-4.5" /> Chat With Us
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map(({ href, label, tagline, Icon }, i) => (
            <Link
              key={label}
              href={href}
              style={{ animationDelay: `${i * 120}ms` }}
              className="group animate-fade-up relative cursor-pointer overflow-hidden rounded-3xl border border-line bg-surface p-8 transition-all duration-300 hover:-translate-y-1 hover:border-gold/60 hover:shadow-xl hover:shadow-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold dark:hover:shadow-black/40"
            >
              <Icon className="h-10 w-10 text-gold transition-transform duration-300 group-hover:scale-110" />
              <h2 className="mt-5 text-2xl font-semibold">{label}</h2>
              <p className="mt-1 text-sm text-muted">{tagline}</p>
              <span className="mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold">
                Explore
                <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <ProductRow
        eyebrow="Limited time"
        title="Hot Sale"
        products={hotSale}
        moreHref="/products?filter=sale"
        eyebrowClass="text-red-500"
      />
      <ProductRow
        eyebrow="Hand-picked"
        title="Featured Pieces"
        products={featured}
        moreHref="/products"
      />
      <ProductRow
        eyebrow="Just landed"
        title="New Arrivals"
        products={newArrivals}
        moreHref="/products?filter=new"
      />
      <ProductRow
        eyebrow="Customer favorites"
        title="Best Sellers"
        products={bestSellers}
        moreHref="/products"
      />

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div className="animate-fade-up">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
              About SOMART
            </p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
              More than a store — a signature.
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              SOMART hand-picks every frame, watch and accessory in our
              collection for design, quality and character. Whether you&apos;re
              hunting for a bold new pair of shades or the watch that completes
              your look, we bring world-class style to your doorstep.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-gold transition-colors duration-200 hover:text-gold-bright"
            >
              Our story <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex justify-center">
            <Image
              src="/logo-mark.jpeg"
              alt=""
              width={260}
              height={260}
              aria-hidden
              className="logo-adaptive animate-float rounded-full opacity-90"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
        <h2 className="max-w-lg text-3xl font-semibold sm:text-4xl">
          Ready to order? It&apos;s one message away.
        </h2>
        <p className="max-w-md leading-relaxed text-muted">
          Browse the collection, then order directly on WhatsApp — fast, personal
          and easy.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hi SOMART! I'd like to place an order.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-2 rounded-full bg-[#25D366] px-8 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-white transition-transform duration-200 hover:scale-[1.03]"
            >
              <WhatsAppIcon className="h-5 w-5" /> Order on WhatsApp
            </a>
          )}
          <Link
            href="/products"
            className="cursor-pointer rounded-full bg-gold-bright px-8 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Browse Everything
          </Link>
        </div>
      </section>
    </>
  );
}
