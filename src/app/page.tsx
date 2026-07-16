import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { getSettings } from "@/models/Setting";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  GlassesIcon,
  MapPinIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  SunglassesIcon,
  TrendingUpIcon,
  TruckIcon,
  WatchIcon,
  WhatsAppIcon,
} from "@/components/icons";

// Serve a cached page and refresh it in the background at most once a minute.
export const revalidate = 60;

// Cities we deliver to across East Africa (city names only, no country names).
const cities = [
  "Hargeisa",
  "Mogadisho",
  "Djibouti",
  "Garowe",
  "Bosaso",
  "Erigavo",
  "Las'anod",
  "Berbera",
  "Burco",
  "Jigjiga",
  "Borama",
  "Diredawa",
];

const features = [
  {
    Icon: GlassesIcon,
    accent: "#3b82f6",
    title: "Designer Eyewear",
    desc: "Premium eyeglasses and sunglasses from the brands you love — hand-picked for every face.",
  },
  {
    Icon: WatchIcon,
    accent: "#8b5cf6",
    title: "Luxury Watches",
    desc: "Timepieces that make every moment count, from everyday classics to statement pieces.",
  },
  {
    Icon: SparklesIcon,
    accent: "#22c55e",
    title: "Fashion Accessories",
    desc: "The finishing details — bags, jewelry and more — that complete your whole look.",
  },
  {
    Icon: ShieldIcon,
    accent: "#38bdf8",
    title: "100% Authentic",
    desc: "Every product is genuine, guaranteed. No fakes, no compromises — ever.",
  },
  {
    Icon: TruckIcon,
    accent: "#fb923c",
    title: "Nationwide Delivery",
    desc: "Fast, reliable delivery to every East African city we serve, with cash on delivery available.",
  },
  {
    Icon: StarIcon,
    accent: "#e879f9",
    title: "Personal Styling",
    desc: "Message us and get tailored recommendations picked just for your style and budget.",
  },
];

const orderTypes = [
  {
    Icon: WatchIcon,
    name: "Watches",
    tagline: "Time, worn beautifully",
    stat: "80+",
    statLabel: "models in stock",
    href: "/products?category=watches",
    popular: false,
    perks: ["Luxury & classic styles", "Authentic movements", "Warranty included", "Gift-ready packaging"],
  },
  {
    Icon: SunglassesIcon,
    name: "Sunglasses",
    tagline: "Shade with attitude",
    stat: "120+",
    statLabel: "styles in stock",
    href: "/products?category=sunglasses",
    popular: true,
    perks: ["UV400 protection", "Designer brands", "Polarized options", "New arrivals weekly"],
  },
  {
    Icon: SparklesIcon,
    name: "Other Accessories",
    tagline: "Finish the look",
    stat: "60+",
    statLabel: "fresh picks",
    href: "/products?category=accessories",
    popular: false,
    perks: ["Bags & wallets", "Jewelry & chains", "Caps & more", "Fresh styles often"],
  },
];

const heroActions = [
  { Icon: GlassesIcon, label: "Eyewear", href: "/products?category=eyeglasses" },
  { Icon: SunglassesIcon, label: "Sunglasses", href: "/products?category=sunglasses" },
  { Icon: WatchIcon, label: "Watches", href: "/products?category=watches" },
  { Icon: SparklesIcon, label: "More", href: "/products?category=accessories" },
];

type SaleItem = { imageUrl: string; title: string; subtitle: string };

type HomeData = {
  heroImage: string;
  showcaseName: string;
  showcaseSubtitle: string;
  saleItems: SaleItem[];
  whatsapp: string;
};

async function getHomeData(): Promise<HomeData> {
  try {
    await connectDB();
    const [featured, settings] = await Promise.all([
      Product.find({ featured: true, visible: { $ne: false } }).limit(1).lean(),
      getSettings(),
    ]);
    const showcase = featured[0] ? JSON.parse(JSON.stringify(featured[0])) : null;

    // The homepage "Sale" section is fully hand-authored in admin → Settings →
    // Sale: up to three custom slots (photo + title + text), no prices.
    const saleItems: SaleItem[] = (settings.saleItems ?? [])
      .map((s) => ({
        imageUrl: s?.imageUrl ?? "",
        title: s?.title ?? "",
        subtitle: s?.subtitle ?? "",
      }))
      .filter((s) => s.title || s.imageUrl)
      .slice(0, 3);

    return {
      heroImage: settings.heroImageUrl || showcase?.imageUrl || "",
      // Name shown on the hero "featured piece" — managed in Settings. When
      // empty it shows a brand default (never a raw product name).
      showcaseName: settings.heroImageTitle || "",
      showcaseSubtitle: settings.heroImageSubtitle || "",
      saleItems,
      whatsapp: settings.whatsappNumber?.replace(/[^0-9]/g, "") ?? "",
    };
  } catch (err) {
    console.error("Failed to load home data:", err);
    return { heroImage: "", showcaseName: "", showcaseSubtitle: "", saleItems: [], whatsapp: "" };
  }
}

export default async function HomePage() {
  const { heroImage, showcaseName, showcaseSubtitle, saleItems, whatsapp } = await getHomeData();
  const heroSale = saleItems.slice(0, 2);
  const waLink = (text: string) =>
    whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}` : "/products";

  return (
    <>
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.16),transparent_55%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.18),transparent_70%)] blur-2xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left: copy */}
          <div className="flex flex-col items-start">
            <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              <ShieldIcon className="h-4 w-4" /> 100% Authentic · East Africa
            </span>
            <h1 className="animate-fade-up delay-100 mt-6 max-w-2xl text-5xl font-extrabold leading-[1.02] sm:text-7xl">
              Style Made
              <br />
              <span className="text-gradient">Iconic</span>.
            </h1>
            <p className="animate-fade-up delay-200 mt-6 max-w-lg text-lg leading-relaxed text-muted">
              Discover designer eyewear, luxury watches and standout accessories —
              curated by SOMART and delivered to your door, anywhere in East Africa.
            </p>
            <div className="animate-fade-up delay-300 mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="group flex cursor-pointer items-center gap-2 rounded-full bg-gold-bright px-7 py-3.5 text-sm font-bold uppercase tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Shop the Collection
                <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <a
                href={waLink("Hi SOMART! I'd like to know how ordering works.")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-7 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-foreground transition-colors duration-200 hover:border-brand/50"
              >
                How It Works
              </a>
            </div>
            <div className="animate-fade-up delay-400 mt-9 flex flex-wrap gap-x-6 gap-y-2">
              {["Authentic Brands", "Cash on Delivery", "Fast Shipping"].map((t) => (
                <span key={t} className="flex items-center gap-2 text-sm font-medium text-muted">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-400" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: showcase card (mirrors the reference's account card) */}
          <div className="animate-fade-up delay-200 relative">
            <div className="absolute -right-3 -top-3 z-10 flex items-center gap-1.5 rounded-2xl border border-line bg-surface/90 px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur">
              <TrendingUpIcon className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400">New drops</span>
              <span className="text-muted">weekly</span>
            </div>
            <div className="rounded-3xl border border-line bg-surface p-5 shadow-2xl shadow-black/30">
              {/* Featured piece */}
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Featured piece
              </p>
              <div className="mt-3 overflow-hidden rounded-2xl bg-brand-gradient p-[1px]">
                <div className="overflow-hidden rounded-2xl bg-background">
                  {heroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={heroImage}
                      alt={showcaseName || "SOMART featured piece"}
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-brand/20 to-brand-2/20 text-foreground">
                      <GlassesIcon className="h-14 w-14" />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{showcaseName || "SOMART Signature"}</p>
                  <p className="text-xs text-muted">{showcaseSubtitle || "Curated selection"}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/12 px-3 py-1.5 text-xs font-semibold text-gold">
                  <WhatsAppIcon className="h-3.5 w-3.5" /> Ask price
                </span>
              </div>

              {/* Quick actions */}
              <div className="mt-5 grid grid-cols-4 gap-2">
                {heroActions.map(({ Icon, label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-line bg-background px-1 py-3 transition-colors duration-200 hover:border-brand/50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/12 text-gold transition-colors duration-200 group-hover:bg-brand/20">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-[10px] font-semibold text-muted">{label}</span>
                  </Link>
                ))}
              </div>

              {/* Mini list — current sale items (no prices) */}
              {heroSale.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    On sale now
                  </p>
                  <ul className="space-y-2">
                    {heroSale.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-2xl border border-line bg-background px-3 py-2.5"
                      >
                        <span className="flex items-center gap-2.5">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/12 text-gold">
                              <SparklesIcon className="h-4 w-4" />
                            </span>
                          )}
                          <span className="text-sm font-medium">{item.title}</span>
                        </span>
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          Sale
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES: How We Can Help Your Style ==================== */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <span className="inline-flex rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Why SOMART
        </span>
        <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold sm:text-5xl">
          How We Can Help Your <span className="text-gradient">Style</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Everything you need to look and feel your best — curated, authentic and
          brought right to your door.
        </p>
        <div className="mt-12 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ Icon, accent, title, desc }) => (
            <div
              key={title}
              className="glow-card rounded-3xl border border-line bg-surface p-7"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${accent}1f`, color: accent }}
              >
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== SALE — 3 custom slots from Settings ==================== */}
      {saleItems.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-red-400">
            Limited Time
          </span>
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold sm:text-5xl">
            On <span className="text-gradient">Sale</span> Now
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            Our hand-picked deals of the moment. Message us on WhatsApp for the
            price and to order.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saleItems.map((item, i) => (
              <div
                key={i}
                className="glow-card group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface text-left"
              >
                <div className="relative overflow-hidden">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand/20 to-brand-2/20 text-foreground">
                      <SparklesIcon className="h-14 w-14" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Sale
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-xl font-bold">{item.title || "Special offer"}</h3>
                  {item.subtitle && (
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
                      {item.subtitle}
                    </p>
                  )}
                  <a
                    href={waLink(
                      `Hi SOMART! I'm interested in your sale item: ${item.title}. What's the price?`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold uppercase tracking-[0.1em] text-white transition-transform duration-200 hover:scale-[1.02]"
                  >
                    <WhatsAppIcon className="h-4.5 w-4.5" /> Ask price on WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ==================== Choose Your Order Type ==================== */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <span className="inline-flex rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Start Here
        </span>
        <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold sm:text-5xl">
          Choose Your <span className="text-gradient">Order Type</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Pick a category and browse the collection. Order online or on WhatsApp —
          it only takes a minute.
        </p>
        <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
          {orderTypes.map(({ Icon, name, tagline, stat, statLabel, href, popular, perks }) => (
            <div
              key={name}
              className={`glow-card relative flex flex-col rounded-3xl border bg-surface p-8 text-left ${
                popular ? "border-brand/60 shadow-2xl shadow-black/30 lg:-mt-4 lg:pb-10" : "border-line"
              }`}
            >
              {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold-bright px-4 py-1 text-[11px] font-bold uppercase tracking-[0.12em]">
                  Most Popular
                </span>
              )}
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  popular ? "bg-gold-bright" : "bg-brand/12 text-gold"
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-2xl font-bold">{name}</h3>
              <p className="mt-1 text-sm text-muted">{tagline}</p>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-gradient">{stat}</span>
                <span className="text-sm text-muted">{statLabel}</span>
              </p>
              <ul className="mt-6 space-y-3">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5 text-sm">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-400" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={href}
                className={`mt-8 cursor-pointer rounded-full px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.12em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                  popular
                    ? "bg-gold-bright"
                    : "border border-line text-foreground hover:border-brand/50"
                }`}
              >
                Shop {name.replace("Other ", "")}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== Delivery: East Africa cities ==================== */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: copy + stats */}
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                <TruckIcon className="h-4 w-4" /> Fast Delivery
              </span>
              <h2 className="mt-5 text-4xl font-extrabold sm:text-5xl">
                Delivered Across <span className="text-gradient">East Africa</span>
              </h2>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">
                From Hargeisa to Mogadisho, Djibouti to Dire Dawa — order online and
                we bring your pieces straight to your door. Cash on delivery available.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={waLink("Hi SOMART! I'd like to place an order.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-[#25D366] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-white transition-transform duration-200 hover:scale-[1.03]"
                >
                  <WhatsAppIcon className="h-5 w-5" /> Order on WhatsApp
                </a>
                <Link
                  href="/products"
                  className="cursor-pointer rounded-full bg-gold-bright px-7 py-3.5 text-sm font-bold uppercase tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  Browse Collection
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                {[
                  { value: "4.9", label: "Avg. Rating" },
                  { value: "10K+", label: "Orders Delivered" },
                  { value: "12+", label: "Cities Covered" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-3xl font-extrabold text-gradient">{s.value}</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: phone mockup */}
            <div className="animate-fade-up delay-200 flex justify-center">
              <div className="relative w-64 rounded-[2.5rem] border border-line bg-background p-3 shadow-2xl shadow-black/40">
                <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-line" />
                <div className="rounded-[1.8rem] bg-surface p-4">
                  <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    SOMART Shop
                  </p>
                  <div className="mt-3 rounded-2xl bg-brand-gradient p-4 text-center text-white">
                    <p className="text-[11px] uppercase tracking-[0.15em] opacity-80">
                      Cash on Delivery
                    </p>
                    <p className="mt-1 text-xl font-extrabold">Order in Minutes</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs">
                      <MapPinIcon className="h-3.5 w-3.5" /> Delivered to your door
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {heroActions.map(({ Icon, label }) => (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/12 text-gold">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-[8px] text-muted">{label}</span>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {heroActions.slice(0, 3).map(({ Icon, label }) => (
                      <li
                        key={label}
                        className="flex items-center justify-between rounded-xl bg-background px-2.5 py-2"
                      >
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/15 text-gold">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-[11px] font-medium">{label}</span>
                        </span>
                        <ArrowRightIcon className="h-3 w-3 text-muted" />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* City chips */}
          <div className="mt-14">
            {/* Delivery cargo cartoon (brand-gradient, system colors) */}
            <div className="flex justify-center">
              <svg
                viewBox="0 0 300 150"
                role="img"
                aria-label="SOMART delivery van"
                className="h-32 w-auto animate-fade-up"
              >
                <defs>
                  <linearGradient id="somart-van" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                {/* motion lines */}
                <g stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" opacity="0.5">
                  <path d="M14 66h34" />
                  <path d="M4 84h26" />
                  <path d="M20 102h30" />
                </g>
                {/* sparkles */}
                <g fill="#60a5fa">
                  <circle cx="250" cy="34" r="3" />
                  <circle cx="272" cy="52" r="2" />
                  <circle cx="238" cy="20" r="2" />
                </g>
                {/* van cargo body */}
                <rect x="70" y="46" width="120" height="66" rx="12" fill="url(#somart-van)" />
                {/* SOMART label on the side */}
                <rect x="86" y="64" width="74" height="30" rx="7" fill="#ffffff" opacity="0.92" />
                <text
                  x="123"
                  y="84"
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight="800"
                  fill="#4f46e5"
                  fontFamily="system-ui, sans-serif"
                >
                  SOMART
                </text>
                {/* cab */}
                <path
                  d="M190 60h26l22 22v30a4 4 0 0 1-4 4h-44V60Z"
                  fill="url(#somart-van)"
                />
                {/* windshield */}
                <path d="M196 66h16l14 14h-30V66Z" fill="#0b1220" opacity="0.55" />
                {/* headlight */}
                <circle cx="234" cy="102" r="3.5" fill="#fde68a" />
                {/* wheels */}
                <g>
                  <circle cx="104" cy="116" r="16" fill="#0b1220" />
                  <circle cx="104" cy="116" r="6.5" fill="#93a1bd" />
                  <circle cx="204" cy="116" r="16" fill="#0b1220" />
                  <circle cx="204" cy="116" r="6.5" fill="#93a1bd" />
                </g>
                {/* ground */}
                <path
                  d="M50 134h210"
                  stroke="#232c44"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              We deliver to
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {cities.map((city) => (
                <span
                  key={city}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-background px-3.5 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:border-brand/50 hover:text-foreground"
                >
                  <MapPinIcon className="h-3.5 w-3.5 text-gold" /> {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== Final CTA ==================== */}
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
        <h2 className="max-w-lg text-4xl font-extrabold sm:text-5xl">
          Ready to <span className="text-gradient">upgrade your look?</span>
        </h2>
        <p className="max-w-md text-lg leading-relaxed text-muted">
          Browse the collection, then order in seconds — online or on WhatsApp.
          Fast, personal and easy.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <a
            href={waLink("Hi SOMART! I'd like to place an order.")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer items-center gap-2 rounded-full bg-[#25D366] px-8 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-white transition-transform duration-200 hover:scale-[1.03]"
          >
            <WhatsAppIcon className="h-5 w-5" /> Order on WhatsApp
          </a>
          <Link
            href="/products"
            className="cursor-pointer rounded-full bg-gold-bright px-8 py-3.5 text-sm font-bold uppercase tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Browse Everything
          </Link>
        </div>
      </section>
    </>
  );
}
