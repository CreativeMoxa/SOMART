import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold">Privacy Policy</h1>
      <div className="mt-8 space-y-6 leading-relaxed text-muted">
        <section>
          <h2 className="text-xl font-semibold text-foreground">Information we collect</h2>
          <p className="mt-2">
            When you contact us or place an order, we may collect your name, phone
            number, email address and delivery address. We use this information only
            to process your orders and respond to your enquiries.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground">How we use your information</h2>
          <p className="mt-2">
            Your details are used to fulfil orders, issue invoices and receipts, and
            provide customer support. We do not sell or share your personal
            information with third parties for marketing purposes.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground">WhatsApp communication</h2>
          <p className="mt-2">
            If you contact us via WhatsApp, your conversation is subject to
            WhatsApp&apos;s own terms and privacy policy in addition to ours.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground">Data security</h2>
          <p className="mt-2">
            We take reasonable technical measures to protect your data. Access to
            customer information is limited to authorized staff only.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p className="mt-2">
            For any privacy-related questions or to request deletion of your data,
            please reach out via our Contact page.
          </p>
        </section>
      </div>
    </div>
  );
}
