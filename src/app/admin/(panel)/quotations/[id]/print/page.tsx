import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Quotation } from "@/models/Quotation";
import { getSettings } from "@/models/Setting";
import PrintDocument, { type PrintableDoc } from "@/components/admin/PrintDocument";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

export default async function QuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectDB();
  const [quotation, settings] = await Promise.all([
    Quotation.findById(id).lean().catch(() => null),
    getSettings(),
  ]);
  if (!quotation) notFound();

  const doc: PrintableDoc = JSON.parse(JSON.stringify(quotation));

  return (
    <div>
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <div className="overflow-hidden rounded-2xl border border-line">
        <PrintDocument
          doc={doc}
          title="Quotation"
          business={{
            companyName: settings.companyName,
            address: settings.address,
            phone: settings.phone,
            email: settings.email,
            invoiceFooter: settings.invoiceFooter,
          }}
        />
      </div>
    </div>
  );
}
