import Link from "next/link";
import Image from "next/image";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/Setting";
import {
  ClockIcon,
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/icons";

type ContactRow = {
  Icon: typeof PhoneIcon;
  label?: string;
  value: string;
  href?: string;
};

export default async function Footer() {
  let settings = null;
  try {
    await connectDB();
    settings = await getSettings();
  } catch {
    // footer still renders without settings
  }

  const s = settings ?? {};
  const wa = (s.whatsappNumber ?? "").replace(/[^0-9]/g, "");

  const contactRows: ContactRow[] = [
    s.salesPhone && {
      Icon: PhoneIcon,
      label: "Sales",
      value: s.salesPhone,
      href: `tel:${s.salesPhone.replace(/\s+/g, "")}`,
    },
    s.operationsPhone && {
      Icon: PhoneIcon,
      label: "Operations",
      value: s.operationsPhone,
      href: `tel:${s.operationsPhone.replace(/\s+/g, "")}`,
    },
    !s.salesPhone && !s.operationsPhone && s.phone && {
      Icon: PhoneIcon,
      value: s.phone,
      href: `tel:${s.phone.replace(/\s+/g, "")}`,
    },
    s.email && { Icon: MailIcon, value: s.email, href: `mailto:${s.email}` },
    s.website && {
      Icon: GlobeIcon,
      value: s.website.replace(/^https?:\/\//, ""),
      href: s.website.startsWith("http") ? s.website : `https://${s.website}`,
    },
    s.address && { Icon: MapPinIcon, value: s.address },
    s.businessHours && { Icon: ClockIcon, value: s.businessHours },
  ].filter(Boolean) as ContactRow[];

  return (
    <footer className="mt-auto border-t border-line bg-surface print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr_1.5fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo-mark.jpeg"
              alt=""
              width={40}
              height={40}
              className="logo-adaptive rounded-full"
            />
            <Image
              src="/logo-wordmark.jpeg"
              alt="SOMART"
              width={120}
              height={28}
              className="logo-adaptive"
            />
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            {s.tagline || "Curated eyewear and fashion accessories, delivered across East Africa."}
          </p>
        </div>

        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Shop</p>
          <ul className="mt-4 space-y-2.5 text-muted">
            <li><Link href="/products?category=eyeglasses" className="cursor-pointer transition-colors duration-200 hover:text-gold">Eyeglasses</Link></li>
            <li><Link href="/products?category=sunglasses" className="cursor-pointer transition-colors duration-200 hover:text-gold">Sunglasses</Link></li>
            <li><Link href="/products?category=watches" className="cursor-pointer transition-colors duration-200 hover:text-gold">Watches</Link></li>
            <li><Link href="/products?category=accessories" className="cursor-pointer transition-colors duration-200 hover:text-gold">Accessories</Link></li>
            <li><Link href="/products?filter=sale" className="cursor-pointer text-red-400 transition-colors duration-200 hover:text-red-300">Sale</Link></li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Company</p>
          <ul className="mt-4 space-y-2.5 text-muted">
            <li><Link href="/about" className="cursor-pointer transition-colors duration-200 hover:text-gold">About Us</Link></li>
            <li><Link href="/contact" className="cursor-pointer transition-colors duration-200 hover:text-gold">Contact</Link></li>
            <li><Link href="/faq" className="cursor-pointer transition-colors duration-200 hover:text-gold">FAQ</Link></li>
            <li><Link href="/privacy" className="cursor-pointer transition-colors duration-200 hover:text-gold">Privacy Policy</Link></li>
            <li><Link href="/terms" className="cursor-pointer transition-colors duration-200 hover:text-gold">Terms &amp; Conditions</Link></li>
          </ul>
        </div>

        {/* Contact — icon-chip rows, all driven by admin settings */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Contact</p>
          <ul className="mt-4 space-y-3">
            {contactRows.map((row, i) => {
              const inner = (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-gold">
                    <row.Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm leading-tight text-muted">
                    {row.label && <span className="text-foreground">{row.label}: </span>}
                    {row.value}
                  </span>
                </>
              );
              return (
                <li key={i}>
                  {row.href ? (
                    <a
                      href={row.href}
                      className="group flex items-center gap-3 transition-colors duration-200 hover:text-foreground"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {wa && (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-bold text-emerald-400 transition-colors duration-200 hover:bg-emerald-500/20"
            >
              <WhatsAppIcon className="h-4.5 w-4.5" /> WhatsApp Us
            </a>
          )}
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {s.companyName || "SOMART"}. All rights reserved.
      </div>
    </footer>
  );
}
