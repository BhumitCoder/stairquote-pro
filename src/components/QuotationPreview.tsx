import type { AppSettings, Invoice, Quotation } from "@/lib/types";
import { formatINR, formatNum, formatDate } from "@/lib/format";
import { BRAND_TAGLINE } from "@/lib/settings-defaults";

// On-screen replica of the generated PDF (see lib/pdf.ts) — instant, crisp and
// mobile-friendly, unlike embedding the PDF blob in an iframe.
// Renders both quotations and bills (tax invoices) — pass either document.
// A clean, minimal letterhead: plenty of whitespace, thin hairline rules and
// a single red accent — built to read as simple and trustworthy to a client.
const RED = "#E8484D";
const TEXT = "#23232D";
const GRAY = "#7D8091";
const LINE = "#DEDEE6";

export function QuotationPreview({
  quote,
  settings,
}: {
  quote: Quotation | Invoice;
  settings: AppSettings;
}) {
  const c = quote.clientSnapshot;
  const avg = quote.totals.area > 0 ? quote.grandTotal / quote.totals.area : 0;
  const inv = "payments" in quote ? (quote as Invoice) : null;

  const clientAddress = [c.address, c.city, c.state].filter(Boolean).join(", ");
  const bankLines = [
    settings.bank.accountName && ["A/C Name", settings.bank.accountName],
    settings.bank.bankName && ["Bank", settings.bank.bankName],
    settings.bank.branch && ["Branch", settings.bank.branch],
    settings.bank.accountNo && ["A/C No", settings.bank.accountNo],
    settings.bank.ifsc && ["IFSC", settings.bank.ifsc],
    settings.bank.upiId && ["UPI", settings.bank.upiId],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="relative overflow-hidden bg-white text-[13px] leading-snug text-zinc-800 shadow-sm">
      {/* Centered logo watermark, very low opacity — the logo is already dark/coloured */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[50%] max-w-[420px] -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ opacity: 0.05 }}
      />

      {/* Header — plain white letterhead: title left, logo right */}
      <div className="relative flex items-start justify-between gap-4 px-5 pt-6 sm:px-7">
        <div>
          <div className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: TEXT }}>
            {inv ? "Tax Invoice" : settings.docTitle}
          </div>
          <span style={{ background: RED }} className="mt-2 block h-1 w-10 rounded-full" />
        </div>
        <img src="/logo.png" alt="" className="h-14 w-auto shrink-0 object-contain sm:h-16" />
      </div>
      <div style={{ background: LINE }} className="relative z-10 mx-5 mt-5 h-px sm:mx-7" />

      {/* Client + meta row */}
      <div className="relative z-10 flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GRAY }}>
            TO,
          </div>
          <div className="mt-1 text-base font-bold" style={{ color: TEXT }}>
            {c.name}
          </div>
          <div className="mt-1 space-y-0.5 text-[12px]" style={{ color: GRAY }}>
            {c.org && <div>{c.org}</div>}
            {c.phone && <div>Mobile: {c.phone}</div>}
            {c.email && <div>{c.email}</div>}
            {clientAddress && <div>{clientAddress}</div>}
          </div>
        </div>
        <div className="flex shrink-0 gap-6 text-left sm:text-right">
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: GRAY }}
            >
              {inv ? "Bill No" : "Quote No"}
            </div>
            <div className="mt-1 text-sm" style={{ color: TEXT }}>
              {quote.number}
            </div>
            {inv?.quotationNumber && (
              <>
                <div
                  className="mt-2 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: GRAY }}
                >
                  Ref. Quotation
                </div>
                <div className="mt-1 text-[12px]" style={{ color: TEXT }}>
                  {inv.quotationNumber}
                </div>
              </>
            )}
          </div>
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: GRAY }}
            >
              Date
            </div>
            <div className="mt-1 text-sm" style={{ color: TEXT }}>
              {formatDate(quote.date)}
            </div>
            {settings.company.salesPerson && (
              <>
                <div
                  className="mt-2 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: GRAY }}
                >
                  Sales By
                </div>
                <div className="mt-1 text-[12px]" style={{ color: TEXT }}>
                  {settings.company.salesPerson}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: LINE }} className="relative z-10 mx-5 mt-5 h-px sm:mx-7" />

      {/* Item description */}
      <div className="relative z-10 px-5 pt-5 sm:px-7">
        <SectionHeading>Item Description</SectionHeading>
      </div>
      <div className="relative z-10 overflow-x-auto px-5 pt-3 sm:px-7">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr style={{ color: TEXT }}>
              <th
                className="border-b-2 px-2 py-2 text-center font-bold"
                style={{ borderColor: TEXT }}
              >
                #
              </th>
              <th
                className="border-b-2 px-2 py-2 text-left font-bold"
                style={{ borderColor: TEXT }}
              >
                Description
              </th>
              <th
                className="border-b-2 px-2 py-2 text-center font-bold"
                style={{ borderColor: TEXT }}
              >
                Width
              </th>
              <th
                className="border-b-2 px-2 py-2 text-center font-bold"
                style={{ borderColor: TEXT }}
              >
                Height
              </th>
              <th
                className="border-b-2 px-2 py-2 text-center font-bold"
                style={{ borderColor: TEXT }}
              >
                Qty
              </th>
              <th
                className="border-b-2 px-2 py-2 text-right font-bold"
                style={{ borderColor: TEXT }}
              >
                Sqft/Rft
              </th>
              <th
                className="border-b-2 px-2 py-2 text-right font-bold"
                style={{ borderColor: TEXT }}
              >
                Rate
              </th>
              <th
                className="border-b-2 px-2 py-2 text-right font-bold"
                style={{ borderColor: TEXT }}
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? "bg-zinc-50" : "bg-white"}>
                <td
                  className="border-b px-2 py-2 text-center align-top"
                  style={{ borderColor: LINE }}
                >
                  {idx + 1}
                </td>
                <td className="border-b px-2 py-2 align-top" style={{ borderColor: LINE }}>
                  <div className="space-y-1.5">
                    <div className="flex gap-2.5">
                      {it.imageUrl && (
                        <img
                          src={it.imageUrl}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded border object-cover"
                        />
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-semibold" style={{ color: TEXT }}>
                          {it.name}
                        </div>
                        {it.location && <div style={{ color: GRAY }}>Location: {it.location}</div>}
                        {(it.material || it.finish) && (
                          <div style={{ color: GRAY }}>
                            {[it.material, it.finish].filter(Boolean).join(" / ")}
                          </div>
                        )}
                        {!!it.steps && <div style={{ color: GRAY }}>Steps: {it.steps}</div>}
                        {!!it.weight && (
                          <div style={{ color: GRAY }}>Weight: {formatNum(it.weight, 2)} Kg</div>
                        )}
                      </div>
                    </div>
                    {it.specs.some((s) => s.trim()) && (
                      <div className="space-y-0.5">
                        {it.specs
                          .filter((s) => s.trim())
                          .map((s, i) => (
                            <div key={i} style={{ color: GRAY }}>
                              - {s}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </td>
                <td
                  className="border-b px-2 py-2 text-center align-top"
                  style={{ borderColor: LINE }}
                >
                  {it.width || "-"}
                </td>
                <td
                  className="border-b px-2 py-2 text-center align-top"
                  style={{ borderColor: LINE }}
                >
                  {it.height || "-"}
                </td>
                <td
                  className="border-b px-2 py-2 text-center align-top"
                  style={{ borderColor: LINE }}
                >
                  {it.qty}
                </td>
                <td
                  className="border-b px-2 py-2 text-right align-top"
                  style={{ borderColor: LINE }}
                >
                  {it.rateMode === "lumpsum" ? "-" : formatNum(it.measureValue * it.qty, 2)}
                </td>
                <td
                  className="border-b px-2 py-2 text-right align-top"
                  style={{ borderColor: LINE }}
                >
                  {it.rateMode === "lumpsum" ? "Lump Sum" : formatNum(it.rate, 2)}
                </td>
                <td
                  className="border-b px-2 py-2 text-right align-top font-medium"
                  style={{ borderColor: LINE, color: TEXT }}
                >
                  {formatNum(it.amount, 2)}
                </td>
              </tr>
            ))}
            <tr className="bg-zinc-50 font-bold" style={{ color: TEXT }}>
              <td className="border-b px-2 py-2" style={{ borderColor: LINE }} />
              <td className="border-b px-2 py-2" style={{ borderColor: LINE }}>
                TOTAL
              </td>
              <td className="border-b px-2 py-2" style={{ borderColor: LINE }} />
              <td className="border-b px-2 py-2" style={{ borderColor: LINE }} />
              <td className="border-b px-2 py-2 text-center" style={{ borderColor: LINE }}>
                {quote.totals.itemCount}
              </td>
              <td className="border-b px-2 py-2 text-right" style={{ borderColor: LINE }}>
                {formatNum(quote.totals.area, 2)}
              </td>
              <td className="border-b px-2 py-2" style={{ borderColor: LINE }} />
              <td className="border-b px-2 py-2 text-right" style={{ borderColor: LINE }}>
                {formatNum(quote.subTotal, 2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Project costing */}
      <div className="relative z-10 px-5 pt-7 sm:px-7">
        <SectionHeading>Project Costing</SectionHeading>
      </div>
      <div className="relative z-10 flex flex-col gap-5 px-5 pt-4 sm:flex-row sm:px-7">
        <div className="flex-1 space-y-4">
          <div className="space-y-1 text-[12px] font-semibold" style={{ color: TEXT }}>
            <div>Total Items : {quote.totals.itemCount}</div>
            <div>Total Area : {formatNum(quote.totals.area, 2)} sqft</div>
            <div>Total Weight : {formatNum(quote.totals.weight, 2)} Kg</div>
            <div>Avg Price / sqft : {formatINR(avg)}</div>
          </div>
          {inv && bankLines.length > 0 && (
            <div>
              <div
                style={{ color: RED }}
                className="text-[11px] font-bold uppercase tracking-wider"
              >
                Bank / Payment Details
              </div>
              <div className="mt-1 space-y-0.5 text-[12px]" style={{ color: TEXT }}>
                {bankLines.map(([k, v]) => (
                  <div key={k}>
                    <span className="inline-block w-20" style={{ color: GRAY }}>
                      {k}
                    </span>
                    : {v}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="w-full shrink-0 sm:w-80">
          <div className="space-y-0 text-[13px]">
            <Row label="Sub Total" value={formatINR(quote.subTotal)} />
            {quote.discountAmt > 0 && (
              <Row
                label={`Discount${
                  quote.discount.mode === "percent" && quote.discount.value
                    ? ` (${quote.discount.value}%)`
                    : ""
                }`}
                value={`- ${formatINR(quote.discountAmt)}`}
              />
            )}
            <Row label={`GST @ ${quote.gstPercent}%`} value={formatINR(quote.gstAmt)} last />
            <div
              className="flex items-center justify-between border-t-2 py-2.5 font-bold"
              style={{ borderColor: RED, color: RED }}
            >
              <span>GRAND TOTAL</span>
              <span>{formatINR(quote.grandTotal)}</span>
            </div>
            {inv && (
              <>
                <div
                  className="flex items-center justify-between border-b py-2 text-emerald-700"
                  style={{ borderColor: LINE }}
                >
                  <span>Received</span>
                  <span>- {formatINR(inv.amountPaid)}</span>
                </div>
                <div
                  className="flex items-center justify-between border-b-2 py-2.5 font-bold"
                  style={{ borderColor: TEXT, color: TEXT }}
                >
                  <span>BALANCE DUE</span>
                  <span>{formatINR(inv.balanceDue)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment history — bills only */}
      {inv && inv.payments.length > 0 && (
        <div className="relative z-10 px-5 pt-6 sm:px-7">
          <SectionHeading>Payment History</SectionHeading>
          <div
            className="mt-3 space-y-2 rounded-md px-4 py-3.5 text-[12px]"
            style={{ background: "#F9F9FB", color: TEXT }}
          >
            {inv.payments.map((p) => (
              <div key={p.id} className="flex items-start gap-2">
                <span
                  style={{ background: RED }}
                  className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full"
                />
                <span className="min-w-0 flex-1">
                  {formatDate(p.date)} &nbsp;|&nbsp; {p.mode}
                  {p.note ? ` — ${p.note}` : ""}
                </span>
                <span className="shrink-0 font-semibold">{formatINR(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms & conditions — quotations only */}
      {!inv && settings.termsAndConditions.some((t) => t.trim()) && (
        <div className="relative z-10 px-5 pt-6 sm:px-7">
          <SectionHeading>Terms &amp; Conditions</SectionHeading>
          <div
            className="mt-3 rounded-md px-4 py-3.5"
            style={{ background: "#F9F9FB", color: TEXT }}
          >
            <ol className="grid gap-x-8 gap-y-1.5 text-[12px] sm:grid-cols-2">
              {settings.termsAndConditions
                .filter((t) => t.trim())
                .map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      style={{ background: RED }}
                      className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full"
                    />
                    <span>{t}</span>
                  </li>
                ))}
            </ol>
          </div>
        </div>
      )}

      {/* Acceptance + signatures */}
      <div className="relative z-10 px-5 pt-7 sm:px-7">
        <p className="text-[11px] italic" style={{ color: GRAY }}>
          {inv
            ? "Received the above goods / services in good order and condition."
            : "I hereby accept the estimate as per above mentioned price and specifications."}
        </p>
        <div className="mt-6 flex items-end justify-between gap-6 text-[11px]">
          <div>
            <div className="h-10" />
            <div className="w-40 border-t pt-1 sm:w-48" style={{ borderColor: LINE, color: GRAY }}>
              Customer Signature &amp; Date
            </div>
          </div>
          <div className="text-right">
            <div className="mb-6 text-[11px] font-bold" style={{ color: TEXT }}>
              For {settings.company.name}
            </div>
            <div className="w-40 border-t pt-1 sm:w-48" style={{ borderColor: LINE, color: GRAY }}>
              Authorized Signatory
            </div>
          </div>
        </div>
        <div style={{ color: RED }} className="pb-6 pt-6 text-center text-[11px] italic">
          Thank you for choosing {settings.company.name}!
        </div>
      </div>

      {/* Footer — plain contact strip, no dark bar */}
      <div
        className="relative z-10 border-t px-5 py-3 text-[10px] sm:px-7"
        style={{ borderColor: LINE, color: GRAY }}
      >
        <div className="text-center">
          {[
            settings.company.address,
            settings.company.phones && `Ph: ${settings.company.phones}`,
            settings.company.email && `Email: ${settings.company.email}`,
            settings.company.website,
          ]
            .filter(Boolean)
            .join("   |   ")}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span>{quote.number}</span>
          <span className="italic" style={{ color: RED }}>
            {BRAND_TAGLINE}
          </span>
          <span>Page 1</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${last ? "" : "border-b"}`}
      style={{ borderColor: LINE, color: TEXT }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b pb-1.5" style={{ borderColor: LINE }}>
      <div
        className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide"
        style={{ color: TEXT }}
      >
        <span style={{ background: RED }} className="h-3.5 w-1 shrink-0 rounded-sm" />
        {children}
      </div>
    </div>
  );
}
