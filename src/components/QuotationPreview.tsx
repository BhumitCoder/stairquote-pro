import type { AppSettings, Quotation } from "@/lib/types";
import { formatINR, formatNum, formatDate } from "@/lib/format";

// On-screen replica of the generated PDF (see lib/pdf.ts) — instant, crisp and
// mobile-friendly, unlike embedding the PDF blob in an iframe.
const RED = "#E8484D";
const DARK = "#1c1c26";
const DARK_MID = "#2d2d3a";

export function QuotationPreview({ quote, settings }: { quote: Quotation; settings: AppSettings }) {
  const c = quote.clientSnapshot;
  const avg = quote.totals.area > 0 ? quote.grandTotal / quote.totals.area : 0;

  const clientAddress = [c.address, c.city, c.state].filter(Boolean).join(", ");

  return (
    <div className="overflow-hidden bg-white text-[13px] leading-snug text-zinc-800 shadow-sm">
      {/* Header */}
      <div style={{ background: DARK }} className="px-5 py-4 text-white sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-bold tracking-wide sm:text-xl">
              {settings.company.name || "Company Name"}
            </div>
            <div className="mt-1 space-y-0.5 text-[11px] text-zinc-300">
              {settings.company.address
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part, i) => (
                  <div key={i}>{part}</div>
                ))}
              {settings.company.website && <div>{settings.company.website}</div>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <img
              src="/logo.png"
              alt=""
              className="h-12 w-auto max-w-[140px] object-contain sm:h-14"
            />
            <div className="space-y-0.5 text-right text-[11px] text-zinc-300">
              {settings.company.phones && <div>Ph: {settings.company.phones}</div>}
              {settings.company.email && <div>Email: {settings.company.email}</div>}
              {settings.company.gst && <div>GSTIN: {settings.company.gst}</div>}
            </div>
          </div>
        </div>
      </div>
      <div style={{ background: RED }} className="h-1" />

      {/* Bill-to strip */}
      <div style={{ background: DARK_MID }} className="px-5 py-3 text-white sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              CLIENT
            </div>
            <div className="mt-0.5 font-semibold">{c.name}</div>
            <div className="mt-0.5 space-y-0.5 text-[11px] text-zinc-300">
              {c.org && <div>{c.org}</div>}
              {c.phone && <div>Mobile: {c.phone}</div>}
              {c.email && <div>{c.email}</div>}
              {clientAddress && <div>{clientAddress}</div>}
            </div>
          </div>
          <div className="flex shrink-0 gap-6 text-left sm:text-right">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Quote No
              </div>
              <div className="mt-0.5 text-sm font-semibold">{quote.number}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Date
              </div>
              <div className="mt-0.5 text-sm">{formatDate(quote.date)}</div>
            </div>
            {settings.company.salesPerson && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Sales By
                </div>
                <div className="mt-0.5 text-sm">{settings.company.salesPerson}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="pt-5 text-center">
        <span
          style={{ color: RED, borderColor: RED }}
          className="inline-block border-b-2 pb-0.5 text-base font-bold uppercase tracking-wider"
        >
          {settings.docTitle}
        </span>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto px-4 pt-4 sm:px-6">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr style={{ background: DARK }} className="text-white">
              <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">#</th>
              <th className="border border-zinc-300 px-2 py-2 text-left font-semibold">
                Description
              </th>
              <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">Width</th>
              <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">Height</th>
              <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">Qty</th>
              <th className="border border-zinc-300 px-2 py-2 text-right font-semibold">
                Sqft/Rft
              </th>
              <th className="border border-zinc-300 px-2 py-2 text-right font-semibold">Rate</th>
              <th className="border border-zinc-300 px-2 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? "bg-zinc-50" : "bg-white"}>
                <td className="border border-zinc-300 px-2 py-2 text-center align-top">
                  {idx + 1}
                </td>
                <td className="border border-zinc-300 px-2 py-2 align-top">
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
                        <div className="font-semibold">{it.name}</div>
                        {it.location && (
                          <div className="text-zinc-600">Location: {it.location}</div>
                        )}
                        {(it.material || it.finish) && (
                          <div className="text-zinc-600">
                            {[it.material, it.finish].filter(Boolean).join(" / ")}
                          </div>
                        )}
                        {!!it.steps && <div className="text-zinc-600">Steps: {it.steps}</div>}
                        {!!it.weight && (
                          <div className="text-zinc-600">Weight: {formatNum(it.weight, 2)} Kg</div>
                        )}
                      </div>
                    </div>
                    {it.specs.some((s) => s.trim()) && (
                      <div className="space-y-0.5">
                        {it.specs
                          .filter((s) => s.trim())
                          .map((s, i) => (
                            <div key={i} className="text-zinc-600">
                              • {s}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="border border-zinc-300 px-2 py-2 text-center align-top">
                  {it.width || "-"}
                </td>
                <td className="border border-zinc-300 px-2 py-2 text-center align-top">
                  {it.height || "-"}
                </td>
                <td className="border border-zinc-300 px-2 py-2 text-center align-top">{it.qty}</td>
                <td className="border border-zinc-300 px-2 py-2 text-right align-top">
                  {it.rateMode === "lumpsum" ? "-" : formatNum(it.measureValue * it.qty, 2)}
                </td>
                <td className="border border-zinc-300 px-2 py-2 text-right align-top">
                  {it.rateMode === "lumpsum" ? "Lump Sum" : formatNum(it.rate, 2)}
                </td>
                <td className="border border-zinc-300 px-2 py-2 text-right align-top font-medium">
                  {formatNum(it.amount, 2)}
                </td>
              </tr>
            ))}
            <tr className="bg-zinc-100 font-bold">
              <td className="border border-zinc-300 px-2 py-2" />
              <td className="border border-zinc-300 px-2 py-2">TOTAL</td>
              <td className="border border-zinc-300 px-2 py-2" />
              <td className="border border-zinc-300 px-2 py-2" />
              <td className="border border-zinc-300 px-2 py-2 text-center">
                {quote.totals.itemCount}
              </td>
              <td className="border border-zinc-300 px-2 py-2 text-right">
                {formatNum(quote.totals.area, 2)}
              </td>
              <td className="border border-zinc-300 px-2 py-2" />
              <td className="border border-zinc-300 px-2 py-2 text-right">
                {formatNum(quote.subTotal, 2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary + totals */}
      <div className="flex flex-col gap-5 px-4 pt-5 sm:flex-row sm:px-6">
        <div className="flex-1 space-y-4">
          <div className="space-y-1 text-[12px] font-semibold">
            <div>Total Items : {quote.totals.itemCount}</div>
            <div>Total Area : {formatNum(quote.totals.area, 2)} sqft</div>
            <div>Total Weight : {formatNum(quote.totals.weight, 2)} Kg</div>
          </div>
        </div>
        <div className="w-full shrink-0 sm:w-80">
          <div className="divide-y divide-zinc-200 border border-zinc-200">
            <div className="flex items-center justify-between bg-zinc-50 px-3 py-2">
              <span>Sub Total</span>
              <span>{formatINR(quote.subTotal)}</span>
            </div>
            <div className="flex items-center justify-between bg-zinc-50 px-3 py-2">
              <span>
                Discount
                {quote.discount.mode === "percent" && quote.discount.value
                  ? ` (${quote.discount.value}%)`
                  : ""}
              </span>
              <span>- {formatINR(quote.discountAmt)}</span>
            </div>
            <div className="flex items-center justify-between bg-zinc-50 px-3 py-2">
              <span>GST @ {quote.gstPercent}%</span>
              <span>{formatINR(quote.gstAmt)}</span>
            </div>
            <div
              style={{ background: RED }}
              className="flex items-center justify-between px-3 py-2.5 font-bold text-white"
            >
              <span>GRAND TOTAL</span>
              <span>{formatINR(quote.grandTotal)}</span>
            </div>
            <div className="flex items-center justify-between bg-zinc-100 px-3 py-2 text-[12px]">
              <span>Avg Price / sqft</span>
              <span>{formatINR(avg)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading notice */}
      {settings.loadingNotice && (
        <div className="px-4 pt-5 sm:px-6">
          <div style={{ color: RED }} className="bg-red-50 px-3 py-2 text-[11px] font-bold">
            * {settings.loadingNotice}
          </div>
        </div>
      )}

      {/* Payment terms */}
      {settings.paymentTerms && (
        <div className="px-4 pt-5 sm:px-6">
          <SectionHeading>Payment Terms</SectionHeading>
          <div className="mt-1.5 whitespace-pre-line text-[12px] text-zinc-700">
            {settings.paymentTerms}
          </div>
        </div>
      )}

      {/* Terms & conditions */}
      {settings.termsAndConditions.length > 0 && (
        <div className="px-4 pt-5 sm:px-6">
          <SectionHeading>Terms &amp; Conditions</SectionHeading>
          <ol className="mt-1.5 space-y-0.5 text-[12px] text-zinc-700">
            {settings.termsAndConditions.map((t, i) => (
              <li key={i}>
                {i + 1}. {t}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Acceptance + signatures */}
      <div className="px-4 pt-6 sm:px-6">
        <p className="text-[11px] italic text-zinc-500">
          I hereby accept the estimate as per above mentioned price and specifications.
        </p>
        <div className="mt-10 flex items-end justify-between gap-6 pb-6 text-[11px]">
          <div>
            <div className="w-36 border-t border-zinc-400 pt-1 sm:w-44">Authorized Signatory</div>
          </div>
          <div className="text-right">
            <div className="w-36 border-t border-zinc-400 pt-1 sm:w-44">Signature of Customer</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{ background: DARK }}
        className="flex items-center justify-between px-5 py-2 text-[10px] text-zinc-400 sm:px-7"
      >
        <span>{quote.number}</span>
        <span>{settings.company.name}</span>
        <span>Page 1</span>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ borderColor: RED }}
      className="inline-block border-b-2 pb-0.5 text-[12px] font-bold uppercase tracking-wide text-zinc-900"
    >
      {children}
    </div>
  );
}
