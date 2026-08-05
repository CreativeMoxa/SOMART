"use client";

import { useState } from "react";
import Link from "next/link";
import { WhatsAppIcon, SparklesIcon } from "@/components/icons";

type SaleItem = { imageUrl: string; images: string[]; title: string; subtitle: string; slug?: string };

export default function SaleShowcase({ items, whatsapp }: { items: SaleItem[]; whatsapp: string }) {
  return (
    <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <SaleCard key={i} item={item} whatsapp={whatsapp} />
      ))}
    </div>
  );
}

function SaleCard({ item, whatsapp }: { item: SaleItem; whatsapp: string }) {
  const imgs = (item.images?.length ? item.images : item.imageUrl ? [item.imageUrl] : []).filter(Boolean);
  const [active, setActive] = useState(0);
  const src = imgs[Math.min(active, imgs.length - 1)];
  const wa = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi SOMART! I'm interested in your sale item: ${item.title}. What's the price?`)}`
    : `https://wa.me/?text=${encodeURIComponent(`Hi SOMART! I'm interested in your sale item: ${item.title}. What's the price?`)}`;

  return (
    <div className="glow-card group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface text-left">
      <div className="relative overflow-hidden">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={item.title} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand/20 to-brand-2/20 text-foreground">
            <SparklesIcon className="h-14 w-14" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Sale</span>
      </div>

      {/* Thumbnail switcher — change photos without leaving the page */}
      {imgs.length > 1 && (
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          {imgs.map((thumb, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActive(idx)}
              aria-label={`Show photo ${idx + 1}`}
              className={`h-11 w-11 overflow-hidden rounded-lg border-2 transition-colors duration-150 ${active === idx ? "border-gold" : "border-line hover:border-gold/50"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {item.slug ? (
          <Link href={`/products/${item.slug}`} className="text-lg font-bold transition-colors duration-200 hover:text-gold">
            {item.title || "Special offer"}
          </Link>
        ) : (
          <h3 className="text-lg font-bold">{item.title || "Special offer"}</h3>
        )}
        {item.subtitle && <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{item.subtitle}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full bg-[#25D366]/90 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-[#25D366]"
          >
            <WhatsAppIcon className="h-3.5 w-3.5" /> Ask price
          </a>
          {item.slug && (
            <Link href={`/products/${item.slug}`} className="inline-flex w-fit items-center rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors duration-200 hover:border-gold hover:text-gold">
              View product
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
