import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "About Us" };

const values = [
  {
    title: "Curated, not crowded",
    text: "We don't stock everything — we stock the right things. Every piece is hand-picked for design, quality and character.",
  },
  {
    title: "Quality you can feel",
    text: "Acetate, titanium, stainless steel and genuine materials. Our products are chosen to last, not just to look good on day one.",
  },
  {
    title: "Personal service",
    text: "Order and ask questions directly on WhatsApp. Real people, real answers, fast.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/logo-mark.jpeg"
          alt=""
          width={80}
          height={80}
          aria-hidden
          className="logo-adaptive animate-float rounded-full"
        />
        <p className="animate-fade-up mt-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
          Our Story
        </p>
        <h1 className="animate-fade-up delay-100 mt-2 text-4xl font-semibold sm:text-5xl">
          About SOMART
        </h1>
        <p className="animate-fade-up delay-200 mt-5 max-w-2xl leading-relaxed text-muted">
          SOMART is a fashion retail brand specializing in designer eyewear,
          watches and accessories. We believe the right pair of frames or the
          right watch isn&apos;t just an item — it&apos;s a signature. Our
          mission is simple: bring world-class style within reach, backed by
          honest prices and personal service.
        </p>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {values.map((value, i) => (
          <div
            key={value.title}
            style={{ animationDelay: `${i * 120}ms` }}
            className="animate-fade-up rounded-3xl border border-line bg-surface p-6"
          >
            <h2 className="text-xl font-semibold">{value.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{value.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 text-center">
        <Link
          href="/products"
          className="cursor-pointer rounded-full bg-gold-bright px-8 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-black transition-transform duration-200 hover:scale-[1.03]"
        >
          Explore the Collection
        </Link>
      </div>
    </div>
  );
}
