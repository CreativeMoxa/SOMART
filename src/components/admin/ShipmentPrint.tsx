import Image from "next/image";
import {
  FREIGHT_META,
  SHIPMENT_STATUS_LABELS,
  type FreightType,
  type ShipmentStatus,
} from "@/lib/freight";

type Item = {
  name: string;
  qty: number;
  costPrice: number;
  sellingPrice: number;
  note?: string;
};

export type PrintableShipment = {
  number: string;
  freightType: FreightType;
  name: string;
  trackingNumber: string;
  shippingDate: string;
  expectedArrival: string;
  status: ShipmentStatus;
  notes: string;
  items: Item[];
  totalQty: number;
  totalCost: number;
  createdAt: string;
};

type Business = {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  invoiceFooter: string;
};

function money(n: number) {
  return `$${(n ?? 0).toFixed(2)}`;
}

export default function ShipmentPrint({
  shipment,
  business,
}: {
  shipment: PrintableShipment;
  business: Business;
}) {
  const meta = FREIGHT_META[shipment.freightType];
  return (
    <div className="mx-auto max-w-2xl bg-white p-10 text-black print:p-0">
      <div className="flex items-start justify-between border-b-2 border-black pb-6">
        <div>
          <Image
            src="/logo-wordmark.jpeg"
            alt={business.companyName}
            width={150}
            height={36}
            style={{ filter: "invert(1)" }}
          />
          <p className="mt-2 text-sm text-neutral-600">
            {business.address && <>{business.address}<br /></>}
            {business.phone && <>{business.phone}<br /></>}
            {business.email}
          </p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold uppercase tracking-wide">{meta.label}</h1>
          <p className="mt-1 font-mono text-lg">{shipment.number}</p>
          <p className="mt-1 text-sm capitalize text-neutral-600">
            Status: {SHIPMENT_STATUS_LABELS[shipment.status]}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="font-bold uppercase tracking-wider text-neutral-500">Shipment</p>
          {shipment.name && <p className="mt-1 text-base font-semibold">{shipment.name}</p>}
          {shipment.trackingNumber && (
            <p className="text-neutral-600">Tracking: {shipment.trackingNumber}</p>
          )}
        </div>
        <div className="text-right">
          {shipment.shippingDate && (
            <p>
              <span className="text-neutral-500">Shipped: </span>
              {shipment.shippingDate}
            </p>
          )}
          {shipment.expectedArrival && (
            <p>
              <span className="text-neutral-500">Expected: </span>
              {shipment.expectedArrival}
            </p>
          )}
        </div>
      </div>

      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-black text-xs uppercase tracking-wider">
            <th className="py-2">Product</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Cost Price</th>
            <th className="py-2 text-right">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {shipment.items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <td className="py-2.5">
                {item.name}
                {item.note && <span className="block text-xs text-neutral-500">{item.note}</span>}
              </td>
              <td className="py-2.5 text-right">{item.qty}</td>
              <td className="py-2.5 text-right">{money(item.costPrice)}</td>
              <td className="py-2.5 text-right font-semibold">{money(item.costPrice * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-56 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-neutral-500">Total quantity</span>
          <span>{shipment.totalQty}</span>
        </div>
        <div className="mt-1 flex justify-between border-t-2 border-black py-2 text-lg font-bold">
          <span>Shipment Total</span>
          <span>{money(shipment.totalCost)}</span>
        </div>
      </div>

      {shipment.notes && (
        <div className="mt-6 text-sm">
          <p className="font-bold uppercase tracking-wider text-neutral-500">Notes</p>
          <p className="mt-1">{shipment.notes}</p>
        </div>
      )}

      <p className="mt-10 border-t border-neutral-200 pt-4 text-center text-sm text-neutral-500">
        {business.invoiceFooter} · Printed {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}
