import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "FAQ" };

const faqs = [
  {
    q: "How do I place an order?",
    a: "Browse the collection, open the product you like, and tap \"Order on WhatsApp\". You'll be connected directly with our team to confirm availability, payment and delivery.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept cash, card, mobile money and bank transfer. Payment details are confirmed with you on WhatsApp when you order.",
  },
  {
    q: "Do you deliver?",
    a: "Yes — delivery options and fees depend on your location. Message us on WhatsApp and we'll confirm the details for your area.",
  },
  {
    q: "Are your products authentic?",
    a: "Every piece in the SOMART collection is hand-picked and quality-checked before it reaches you.",
  },
  {
    q: "Can I return or exchange an item?",
    a: "If something isn't right, contact us within 7 days of purchase with your receipt or invoice number and we'll work out a return or exchange.",
  },
  {
    q: "Do you offer discounts?",
    a: "Keep an eye on our Sale section — products with a red badge are discounted for a limited time.",
  },
];

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="animate-fade-up text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
        Help Center
      </p>
      <h1 className="animate-fade-up delay-100 mt-1 text-4xl font-semibold">
        Frequently Asked Questions
      </h1>

      <div className="mt-10 space-y-3">
        {faqs.map((faq, i) => (
          <details
            key={faq.q}
            style={{ animationDelay: `${i * 80}ms` }}
            className="animate-fade-up group rounded-2xl border border-line bg-surface px-6 py-4"
          >
            <summary className="cursor-pointer list-none text-lg font-semibold transition-colors duration-200 group-open:text-gold">
              {faq.q}
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{faq.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-center text-muted">
        Still have a question?{" "}
        <Link href="/contact" className="cursor-pointer font-semibold text-gold hover:underline">
          Contact us
        </Link>
        .
      </p>
    </div>
  );
}
