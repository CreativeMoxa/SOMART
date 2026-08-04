/* eslint-disable @next/next/no-img-element */

type LineItem = { name: string; price: number; qty: number };

export type PrintableDoc = {
  number: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
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
  tagline?: string;
  bankAccount?: string;
  currencySymbol?: string;
  elementLogoUrl?: string;
};

function shortDate(d: string | Date) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}/${date.getFullYear()}`;
}

// Brand document palette — deep navy ink with soft lavender accents.
const NAVY = "#16225c";
const MUTED = "#5b6478";
const BORDER = "#d8dae8";
const BAND = "#eef0fc";
const DECOR = "#ebe9fb";
const AMOUNT_BG = "#f3f4fc";

export default function PrintDocument({
  doc,
  business,
  title,
}: {
  doc: PrintableDoc;
  business: Business;
  title: string;
}) {
  const symbol = business.currencySymbol || "$";
  const money = (n: number) => `${symbol} ${n.toFixed(2)}`;
  const isInvoice = title.toLowerCase().includes("invoice");
  const isPaid = isInvoice && doc.status === "paid";
  const leftLabel = isInvoice ? "Invoice Date" : "Quotation Date";
  const rightLabel = isInvoice ? "Due Date" : "Valid Until";
  const rightValue = isInvoice ? doc.dueDate : doc.validUntil;
  const hasBreakdown = doc.discount > 0 || doc.tax > 0;

  return (
    <div
      className="relative mx-auto max-w-[820px] overflow-hidden bg-white px-12 py-10"
      style={{
        color: NAVY,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        minHeight: "1000px",
      }}
    >
      {/* Decorative grey curves */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: "-160px",
          right: "-120px",
          width: "540px",
          height: "320px",
          borderRadius: "50%",
          background: DECOR,
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          bottom: "-150px",
          left: "-120px",
          width: "300px",
          height: "280px",
          borderRadius: "50%",
          background: DECOR,
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          bottom: "-170px",
          right: "-60px",
          width: "420px",
          height: "300px",
          borderRadius: "50%",
          background: DECOR,
        }}
      />

      <div className="relative">
        {/* Header: tagline (left) + logo mark & location (right) */}
        <div className="flex items-start justify-between gap-6">
          <p className="max-w-[55%] text-sm font-bold">
            {business.tagline || business.companyName}
          </p>
          <div className="text-right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={business.elementLogoUrl || "/logo-mark-navy.png"}
              alt={business.companyName}
              width={48}
              height={48}
              className="ml-auto object-contain"
              style={{ background: "transparent" }}
            />
            <div className="mt-2 space-y-1.5">
              {business.address && (
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-sm" style={{ color: MUTED }}>{business.address}</span>
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: NAVY }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                  </span>
                </div>
              )}
              {business.phone && (
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-sm" style={{ color: MUTED }}>{business.phone}</span>
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: NAVY }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
                    </svg>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer block (left) + document title (right) */}
        <div className="mt-14 flex items-start justify-between gap-6">
          <div>
            <p className="text-base">{doc.customerName}</p>
            {doc.customerAddress && (
              <p className="mt-0.5 text-sm" style={{ color: MUTED }}>
                {doc.customerAddress}
              </p>
            )}
          </div>
          <h1 className="text-right text-3xl font-light leading-tight">
            {title} {doc.number}
          </h1>
        </div>

        {/* Date band */}
        <div
          className="mt-6 flex gap-20 rounded-md px-5 py-3"
          style={{ background: BAND }}
        >
          <div>
            <p className="text-sm font-bold">{leftLabel}</p>
            <p className="text-sm" style={{ color: MUTED }}>
              {shortDate(doc.createdAt)}
            </p>
          </div>
          {rightValue && (
            <div>
              <p className="text-sm font-bold">{rightLabel}</p>
              <p className="text-sm" style={{ color: MUTED }}>
                {shortDate(rightValue)}
              </p>
            </div>
          )}
        </div>

        {/* Items table — rounded framed */}
        <div className="mt-5 overflow-hidden" style={{ border: `1px solid ${BORDER}`, borderRadius: 12 }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: NAVY, color: "#fff" }}>
              <th className="px-3 py-2.5 text-left font-medium">Description</th>
              <th className="px-3 py-2.5 text-right font-medium">Quantity</th>
              <th className="px-3 py-2.5 text-right font-medium">Unit Price</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-2.5" style={{ border: `1px solid ${BORDER}` }}>
                  {item.name}
                </td>
                <td
                  className="px-3 py-2.5 text-right"
                  style={{ border: `1px solid ${BORDER}` }}
                >
                  {item.qty.toFixed(2)}
                </td>
                <td
                  className="px-3 py-2.5 text-right"
                  style={{ border: `1px solid ${BORDER}` }}
                >
                  {item.price.toFixed(2)}
                </td>
                <td
                  className="px-3 py-2.5 text-right"
                  style={{ border: `1px solid ${BORDER}`, background: AMOUNT_BG }}
                >
                  {money(item.price * item.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Payment info (left) + totals box (right) */}
        <div className="mt-5 flex items-start justify-between gap-6">
          <div className="text-sm">
            <p>
              Payment Communication: <strong>{doc.number}</strong>
            </p>
            {business.bankAccount && (
              <p className="mt-1">
                on this account: <strong>{business.bankAccount}</strong>
              </p>
            )}
          </div>

          <div className="w-[280px] text-sm">
            {hasBreakdown && (
              <>
                <TotalRow label="Subtotal" value={money(doc.subtotal)} />
                {doc.discount > 0 && (
                  <TotalRow label="Discount" value={`- ${money(doc.discount)}`} />
                )}
                {doc.tax > 0 && <TotalRow label="Tax" value={money(doc.tax)} />}
              </>
            )}
            <div
              className="flex justify-between px-4 py-2.5 font-bold"
              style={{ background: NAVY, color: "#fff", borderRadius: 10 }}
            >
              <span>Total</span>
              <span>{money(doc.total)}</span>
            </div>
            {isPaid ? (
              <>
                <div
                  className="flex justify-between px-3 py-2 italic"
                  style={{ border: `1px solid ${BORDER}`, color: MUTED }}
                >
                  <span>Paid on {shortDate(doc.createdAt)}</span>
                  <span>{money(doc.total)}</span>
                </div>
                <TotalRow label="Amount Due" value={money(0)} bold />
              </>
            ) : (
              isInvoice && (
                <TotalRow label="Amount Due" value={money(doc.total)} bold />
              )
            )}
          </div>
        </div>

        {doc.notes && (
          <div className="mt-8 text-sm">
            <p className="font-bold uppercase tracking-wider" style={{ color: MUTED }}>
              Notes
            </p>
            <p className="mt-1">{doc.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-20 text-center text-sm" style={{ color: MUTED }}>
          {business.invoiceFooter && <p>{business.invoiceFooter}</p>}
          <p className="mt-1" style={{ color: "#9a9a9a" }}>
            Page 1 / 1
          </p>
        </div>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between px-3 py-2 ${bold ? "font-bold" : ""}`}
      style={{ border: `1px solid ${BORDER}` }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
