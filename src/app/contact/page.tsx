import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/Setting";
import { WhatsAppIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Contact Us" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  let settings = null;
  try {
    await connectDB();
    settings = await getSettings();
  } catch {
    // page renders with fallbacks
  }
  const whatsapp = settings?.whatsappNumber?.replace(/[^0-9]/g, "") ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="animate-fade-up text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
        Get in Touch
      </p>
      <h1 className="animate-fade-up delay-100 mt-1 text-4xl font-semibold">Contact Us</h1>
      <p className="animate-fade-up delay-200 mt-3 leading-relaxed text-muted">
        Questions about a product, an order, or anything else? The fastest way to
        reach us is WhatsApp — we usually reply within minutes during opening hours.
      </p>

      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hi SOMART! I have a question.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="animate-fade-up delay-300 mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#25D366] px-8 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-white transition-transform duration-200 hover:scale-[1.03]"
        >
          <WhatsAppIcon className="h-5 w-5" /> Chat on WhatsApp
        </a>
      )}

      <div className="animate-fade-up delay-400 mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Store Details</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {settings?.address && <li>{settings.address}</li>}
            {settings?.phone && <li>Phone: {settings.phone}</li>}
            {settings?.email && <li>Email: {settings.email}</li>}
            {!settings?.address && !settings?.phone && !settings?.email && (
              <li>Contact details coming soon.</li>
            )}
          </ul>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Opening Hours</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Monday – Saturday: 9:00 AM – 7:00 PM</li>
            <li>Sunday: Closed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
