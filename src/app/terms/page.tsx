import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold">Terms &amp; Conditions</h1>
      <div className="mt-8 space-y-6 leading-relaxed text-muted">
        <section>
          <h2 className="text-xl font-semibold text-foreground">Orders</h2>
          <p className="mt-2">
            Orders are placed via WhatsApp or in store. An order is confirmed once we
            verify availability and you receive a confirmation message or invoice.
            Prices shown on the website may change without notice.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground">Payment</h2>
          <p className="mt-2">
            We accept cash, card, mobile money and bank transfer. Payment terms for
            invoiced orders are stated on the invoice.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground">Delivery</h2>
          <p className="mt-2">
            Delivery times and fees vary by location and are confirmed with you before
            dispatch. Risk passes to the buyer upon delivery.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground">Returns &amp; exchanges</h2>
          <p className="mt-2">
            Items may be returned or exchanged within 7 days of purchase in original,
            unused condition with proof of purchase. Discounted sale items may be
            exchanged but are not refundable.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground">Warranty</h2>
          <p className="mt-2">
            Manufacturing defects are covered per product category and confirmed at
            purchase. Damage from misuse or normal wear is not covered.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p className="mt-2">
            For any questions regarding these terms, contact us via the details on our
            Contact page.
          </p>
        </section>
      </div>
    </div>
  );
}
