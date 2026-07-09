import Link from "next/link";
import Image from "next/image";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/Setting";

export default async function Footer() {
  let settings = null;
  try {
    await connectDB();
    settings = await getSettings();
  } catch {
    // footer still renders without settings
  }

  return (
    <footer className="mt-auto border-t border-line bg-surface print:hidden">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-4 sm:px-6">
        <div>
          <Image
            src="/logo-wordmark.jpeg"
            alt="SOMART"
            width={130}
            height={30}
            className="logo-adaptive"
          />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {settings?.tagline || "Curated eyewear and fashion accessories."}
          </p>
        </div>
        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Shop</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link href="/products?category=eyeglasses" className="cursor-pointer transition-colors duration-200 hover:text-gold">Eyeglasses</Link></li>
            <li><Link href="/products?category=sunglasses" className="cursor-pointer transition-colors duration-200 hover:text-gold">Sunglasses</Link></li>
            <li><Link href="/products?category=watches" className="cursor-pointer transition-colors duration-200 hover:text-gold">Watches</Link></li>
            <li><Link href="/products?category=accessories" className="cursor-pointer transition-colors duration-200 hover:text-gold">Accessories</Link></li>
            <li><Link href="/products?filter=sale" className="cursor-pointer text-red-500 transition-colors duration-200 hover:text-red-400">Sale</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Company</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link href="/about" className="cursor-pointer transition-colors duration-200 hover:text-gold">About Us</Link></li>
            <li><Link href="/contact" className="cursor-pointer transition-colors duration-200 hover:text-gold">Contact</Link></li>
            <li><Link href="/faq" className="cursor-pointer transition-colors duration-200 hover:text-gold">FAQ</Link></li>
            <li><Link href="/privacy" className="cursor-pointer transition-colors duration-200 hover:text-gold">Privacy Policy</Link></li>
            <li><Link href="/terms" className="cursor-pointer transition-colors duration-200 hover:text-gold">Terms &amp; Conditions</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Get in Touch</p>
          <ul className="mt-3 space-y-2 text-muted">
            {settings?.address && <li>{settings.address}</li>}
            {settings?.phone && <li>{settings.phone}</li>}
            {settings?.email && <li>{settings.email}</li>}
            {settings?.whatsappNumber && (
              <li>
                <a
                  href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer font-semibold text-emerald-500 transition-colors duration-200 hover:text-emerald-400"
                >
                  Chat on WhatsApp →
                </a>
              </li>
            )}
            <li>Mon–Sat: 9am – 7pm</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {settings?.companyName || "SOMART"}. All rights reserved.
      </div>
    </footer>
  );
}
