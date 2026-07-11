import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Shipment } from "@/models/Shipment";
import { getSettings } from "@/models/Setting";
import ShipmentPrint, { type PrintableShipment } from "@/components/admin/ShipmentPrint";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

export default async function AirFreightPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  await connectDB();
  const [shipment, settings] = await Promise.all([
    Shipment.findById(id).lean().catch(() => null),
    getSettings(),
  ]);
  if (!shipment || shipment.freightType !== "air") notFound();

  const doc: PrintableShipment = JSON.parse(JSON.stringify(shipment));

  return (
    <div>
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton auto={auto === "1"} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-line">
        <ShipmentPrint
          shipment={doc}
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
