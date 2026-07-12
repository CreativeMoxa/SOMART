import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { Product } from "@/models/Product";
import { getSettings } from "@/models/Setting";
import PrintDocument, { type PrintableDoc } from "@/components/admin/PrintDocument";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  await connectDB();
  const [invoice, settings] = await Promise.all([
    Invoice.findById(id).lean().catch(() => null),
    getSettings(),
  ]);
  if (!invoice) notFound();

  // Guard: an unpaid invoice containing an out-of-stock product must not be
  // printed — paying it would sell stock that doesn't exist and corrupt the
  // sales + money records. Paid invoices already deducted stock, so allow reprints.
  let outOfStock: string[] = [];
  if (invoice.status !== "paid") {
    const ids = invoice.items
      .map((i) => i.productId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));
    if (ids.length) {
      const products = await Product.find({ _id: { $in: ids } })
        .select("_id stockQty")
        .lean();
      const stockById = new Map(products.map((p) => [String(p._id), p.stockQty ?? 0]));
      outOfStock = invoice.items
        .filter((i) => i.productId && (stockById.get(String(i.productId)) ?? 0) <= 0)
        .map((i) => i.name);
    }
  }

  if (outOfStock.length > 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-8">
          <h1 className="text-2xl font-semibold text-amber-500">Cannot print this invoice</h1>
          <p className="mt-3 text-sm text-muted">
            The following {outOfStock.length === 1 ? "product is" : "products are"} out of
            stock:
          </p>
          <p className="mt-2 font-semibold">{outOfStock.join(", ")}</p>
          <p className="mt-4 text-sm text-muted">
            Restock {outOfStock.length === 1 ? "it" : "them"} before printing or marking
            this invoice paid. Selling unavailable stock corrupts your sales and money
            records.
          </p>
          <Link
            href="/admin/invoices"
            className="mt-6 inline-block rounded-full bg-gold-bright px-6 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black"
          >
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const doc: PrintableDoc = JSON.parse(JSON.stringify(invoice));

  return (
    <div>
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton auto={auto === "1"} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-line">
        <PrintDocument
          doc={doc}
          title="Invoice"
          business={{
            companyName: settings.companyName,
            address: settings.address,
            phone: settings.phone,
            email: settings.email,
            invoiceFooter: settings.invoiceFooter,
            tagline: settings.tagline,
            bankAccount: settings.bankAccount,
            currencySymbol: settings.currencySymbol,
          }}
        />
      </div>
    </div>
  );
}
