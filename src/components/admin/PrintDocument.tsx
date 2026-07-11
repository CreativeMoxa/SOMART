import Image from "next/image";

type LineItem = { name: string; price: number; qty: number };

export type PrintableDoc = {
  number: string;
  customerName: string;
  customerPhone: string;
  items: LineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  dueDate?: string;
  validUntil?: string;
  notes: string;
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
  return `$${n.toFixed(2)}`;
}

export default function PrintDocument({
  doc,
  business,
  title,
}: {
  doc: PrintableDoc;
  business: Business;
  title: string;
}) {
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
          <h1 className="text-3xl font-bold uppercase tracking-wide">{title}</h1>
          <p className="mt-1 font-mono text-lg">{doc.number}</p>
          <p className="mt-1 text-sm capitalize text-neutral-600">Status: {doc.status}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <div>
          <p className="font-bold uppercase tracking-wider text-neutral-500">Billed To</p>
          <p className="mt-1 text-lg font-semibold">{doc.customerName}</p>
          {doc.customerPhone && <p className="text-neutral-600">{doc.customerPhone}</p>}
        </div>
        <div className="text-right">
          <p>
            <span className="text-neutral-500">Date: </span>
            {new Date(doc.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          {doc.dueDate && (
            <p>
              <span className="text-neutral-500">Due: </span>
              {doc.dueDate}
            </p>
          )}
          {doc.validUntil && (
            <p>
              <span className="text-neutral-500">Valid until: </span>
              {doc.validUntil}
            </p>
          )}
        </div>
      </div>

      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-black text-xs uppercase tracking-wider">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Unit Price</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <td className="py-2.5">{item.name}</td>
              <td className="py-2.5 text-right">{money(item.price)}</td>
              <td className="py-2.5 text-right">{item.qty}</td>
              <td className="py-2.5 text-right font-semibold">
                {money(item.price * item.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-56 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-neutral-500">Subtotal</span>
          <span>{money(doc.subtotal)}</span>
        </div>
        {doc.discount > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Discount</span>
            <span>−{money(doc.discount)}</span>
          </div>
        )}
        {doc.tax > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Tax</span>
            <span>{money(doc.tax)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t-2 border-black py-2 text-lg font-bold">
          <span>Total</span>
          <span>{money(doc.total)}</span>
        </div>
      </div>

      {doc.notes && (
        <div className="mt-6 text-sm">
          <p className="font-bold uppercase tracking-wider text-neutral-500">Notes</p>
          <p className="mt-1">{doc.notes}</p>
        </div>
      )}

      <p className="mt-10 border-t border-neutral-200 pt-4 text-center text-sm text-neutral-500">
        {business.invoiceFooter}
      </p>
    </div>
  );
}
