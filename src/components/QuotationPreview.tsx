import type { AppSettings, Invoice, Quotation } from "@/lib/types";
import { formatINR, formatNum, formatDate } from "@/lib/format";

// Luxury editorial document — designed for an audience of architects and
// designers. Serif display type (Playfair), generous whitespace, hairline
// rules, item "showcase" cards instead of a dense grid, and a hero total.
// The PDF is a pixel-exact capture of this component (see lib/pdf-capture).
const RED = "#E8484D";
const INK = "#1B1B23";
const BODY = "#4A4A55";
const GRAY = "#8A8DA0";
const HAIR = "#EAEAF0";
const SERIF = '"Playfair Display", Georgia, "Times New Roman", serif';

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
    <div
      className="relative overflow-hidden bg-white text-[13px] leading-snug"
      style={{ color: BODY }}
    >
      {/* Centered logo watermark, very low opacity */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden
        data-watermark
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[50%] max-w-[420px] -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ opacity: 0.05 }}
      />

      {/* ── Brand band — light, matching the dark-on-transparent logo ── */}
      <div className="relative z-10 flex items-center justify-between gap-6 px-8 pb-6 pt-8 sm:px-10">
        <img src="/logo.png" alt="" className="h-14 w-auto shrink-0 object-contain sm:h-16" />
        <div className="text-right">
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.35em]"
            style={{ color: GRAY }}
          >
            {inv ? "Tax Invoice" : settings.docTitle}
          </div>
          <div style={{ fontFamily: SERIF, color: INK }} className="mt-1.5 text-[22px]">
            {quote.number}
          </div>
          <div className="mt-1 text-[11px] tracking-wide" style={{ color: GRAY }}>
            {formatDate(quote.date)}
            {inv?.quotationNumber ? ` · Ref. ${inv.quotationNumber}` : ""}
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-8 h-px sm:mx-10" style={{ background: HAIR }} />
      <div style={{ background: RED }} className="relative z-10 ml-8 h-[3px] w-24 sm:ml-10" />

      {/* ── Prepared for ── */}
      <div
        data-block
        className="relative z-10 flex flex-col gap-6 px-8 pt-9 sm:flex-row sm:items-start sm:justify-between sm:px-10"
      >
        <div className="min-w-0">
          <SectionLabel>Prepared For</SectionLabel>
          <div
            style={{ fontFamily: SERIF, color: INK }}
            className="mt-2.5 text-[24px] font-semibold leading-tight"
          >
            {c.name}
          </div>
          <div className="mt-2 space-y-0.5 text-[12px]" style={{ color: GRAY }}>
            {c.org && <div>{c.org}</div>}
            {c.phone && <div>Mobile: {c.phone}</div>}
            {c.email && <div>{c.email}</div>}
            {clientAddress && <div>{clientAddress}</div>}
          </div>
        </div>
        {settings.company.salesPerson && (
          <div className="shrink-0 sm:text-right">
            <SectionLabel>Your Consultant</SectionLabel>
            <div className="mt-2.5 text-[13px] font-medium" style={{ color: INK }}>
              {settings.company.salesPerson}
            </div>
          </div>
        )}
      </div>

      {/* ── Scope of work — item showcase ── */}
      <div data-block className="relative z-10 px-8 pt-9 sm:px-10">
        <SectionRule>Scope of Work</SectionRule>
        <div>
          {quote.items.map((it, idx) => {
            const meta = [
              it.location && `Location: ${it.location}`,
              [it.material, it.finish].filter(Boolean).join(" / "),
              it.steps ? `${it.steps} Steps` : "",
              it.width && it.height ? `${it.width} × ${it.height} mm` : it.width ? `W ${it.width} mm` : it.height ? `H ${it.height} mm` : "",
              it.rateMode === "sqft" || it.rateMode === "rft"
                ? it.measureValue
                  ? `${formatNum(it.measureValue * it.qty, 2)} ${it.measureUnit}`
                  : ""
                : "",
              it.weight ? `${formatNum(it.weight, 2)} Kg` : "",
            ].filter(Boolean);
            return (
              <div
                key={idx}
                // Items after the first are their own blocks so a long list can
                // break cleanly BETWEEN cards (never through one).
                {...(idx > 0 ? { "data-block": true } : {})}
                className="flex gap-5 border-b py-6"
                style={{ borderColor: HAIR }}
              >
                {it.imageUrl && (
                  <img
                    src={it.imageUrl}
                    alt=""
                    className="h-28 w-28 shrink-0 rounded-lg object-cover"
                    style={{ boxShadow: "0 3px 14px rgba(20,20,30,0.12)" }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <div
                        style={{ fontFamily: SERIF, color: INK }}
                        className="text-[19px] font-semibold leading-tight"
                      >
                        <span style={{ color: RED }}>{String(idx + 1).padStart(2, "0")}.</span>{" "}
                        {it.name}
                      </div>
                      {meta.length > 0 && (
                        <div className="mt-1.5 text-[11.5px]" style={{ color: GRAY }}>
                          {meta.join("   ·   ")}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className="text-[9px] font-semibold uppercase tracking-[0.25em]"
                        style={{ color: GRAY }}
                      >
                        Amount
                      </div>
                      <div
                        style={{ fontFamily: SERIF, color: INK }}
                        className="mt-0.5 text-[18px] font-semibold"
                      >
                        {formatINR(it.amount)}
                      </div>
                      <div className="mt-0.5 text-[11px]" style={{ color: GRAY }}>
                        Qty {it.qty}
                        {it.rate > 0 && (
                          <>
                            {" · "}
                            {it.rateMode === "lumpsum"
                              ? "Lump Sum"
                              : it.rateMode === "step"
                                ? `${formatINR(it.rate)} / step`
                                : it.rateMode === "sqft" || it.rateMode === "rft"
                                  ? `${formatINR(it.rate)} / ${it.measureUnit}`
                                  : `${formatINR(it.rate)} / ${it.rateMode}`}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {it.specs.some((s) => s.trim()) && (
                    <div
                      className="mt-3 space-y-1 text-[12px] leading-relaxed"
                      style={{ color: BODY }}
                    >
                      {it.specs
                        .filter((s) => s.trim())
                        .map((s, i) => (
                          <div key={i} className="flex gap-2">
                            <span
                              style={{ background: RED }}
                              className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                            />
                            <span>{s}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Investment summary ── */}
      <div data-block className="relative z-10 px-8 pt-9 sm:px-10">
        <SectionRule>{inv ? "Payment Summary" : "Investment Summary"}</SectionRule>
        <div className="flex flex-col gap-8 pt-1 sm:flex-row sm:justify-between">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-10 gap-y-2.5 text-[12px]">
              <Fact label="Total Items" value={String(quote.totals.itemCount)} />
              {quote.totals.area > 0 && (
                <Fact label="Total Area" value={`${formatNum(quote.totals.area, 2)} sqft`} />
              )}
              {quote.totals.weight > 0 && (
                <Fact label="Total Weight" value={`${formatNum(quote.totals.weight, 2)} Kg`} />
              )}
              {avg > 0 && <Fact label="Avg / sqft" value={formatINR(avg)} />}
            </div>
            {inv && bankLines.length > 0 && (
              <div className="pt-1">
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                  style={{ color: RED }}
                >
                  Bank / Payment Details
                </div>
                <div className="mt-2 space-y-1 text-[12px]" style={{ color: BODY }}>
                  {bankLines.map(([k, v]) => (
                    <div key={k}>
                      <span className="inline-block w-20" style={{ color: GRAY }}>
                        {k}
                      </span>
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-full shrink-0 sm:w-80">
            <div className="text-[12.5px]">
              <SummaryRow label="Sub Total" value={formatINR(quote.subTotal)} />
              {quote.discountAmt > 0 && (
                <SummaryRow
                  label={`Discount${
                    quote.discount.mode === "percent" && quote.discount.value
                      ? ` (${quote.discount.value}%)`
                      : ""
                  }`}
                  value={`- ${formatINR(quote.discountAmt)}`}
                />
              )}
              {quote.gstAmt > 0 && (
                <SummaryRow label={`GST @ ${quote.gstPercent}%`} value={formatINR(quote.gstAmt)} />
              )}
            </div>

            {inv ? (
              <>
                <div
                  className="mt-2 flex items-baseline justify-between border-t pt-2.5"
                  style={{ borderColor: INK }}
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                    style={{ color: GRAY }}
                  >
                    Grand Total
                  </span>
                  <span style={{ fontFamily: SERIF, color: INK }} className="text-[17px]">
                    {formatINR(quote.grandTotal)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between text-[12.5px]">
                  <span style={{ color: GRAY }}>Received</span>
                  <span className="text-emerald-700">- {formatINR(inv.amountPaid)}</span>
                </div>
                <div
                  className="mt-2 flex items-baseline justify-between border-t-2 pt-3"
                  style={{ borderColor: RED }}
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                    style={{ color: GRAY }}
                  >
                    Balance Due
                  </span>
                  <span
                    style={{ fontFamily: SERIF, color: RED }}
                    className="text-[26px] font-semibold"
                  >
                    {formatINR(inv.balanceDue)}
                  </span>
                </div>
              </>
            ) : (
              <div
                className="mt-2 flex items-baseline justify-between border-t-2 pt-3"
                style={{ borderColor: INK }}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                  style={{ color: GRAY }}
                >
                  Grand Total
                </span>
                <span
                  style={{ fontFamily: SERIF, color: INK }}
                  className="text-[26px] font-semibold"
                >
                  {formatINR(quote.grandTotal)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Payment history — bills only ── */}
      {inv && inv.payments.length > 0 && (
        <div data-block className="relative z-10 px-8 pt-9 sm:px-10">
          <SectionRule>Payment History</SectionRule>
          <div className="pt-1">
            {inv.payments.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-baseline justify-between gap-4 py-2 text-[12px] ${
                  i > 0 ? "border-t" : ""
                }`}
                style={{ borderColor: HAIR }}
              >
                <span style={{ color: BODY }}>
                  {formatDate(p.date)} &nbsp;·&nbsp; {p.mode}
                  {p.note ? ` — ${p.note}` : ""}
                </span>
                <span className="font-medium" style={{ color: INK }}>
                  {formatINR(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Terms — quotations only ── */}
      {!inv && settings.termsAndConditions.some((t) => t.trim()) && (
        <div className="relative z-10 px-8 pt-9 sm:px-10">
          <SectionRule>Terms &amp; Conditions</SectionRule>
          <ol className="grid gap-y-3 pt-1 text-[11.5px] leading-relaxed">
            {settings.termsAndConditions
              .filter((t) => t.trim())
              .map((t, i) => (
                <li key={i} data-block className="flex items-start gap-2.5">
                  <span
                    style={{ background: RED }}
                    className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                  />
                  <span style={{ color: BODY }} className="whitespace-pre-line">{t}</span>
                </li>
              ))}
          </ol>
        </div>
      )}

      {/* ── Signatures + thank-you + footer — one unbreakable block ── */}
      <div data-block>
        <div className="relative z-10 px-8 pt-8 sm:px-10">
          <div className="flex items-end justify-between gap-6 text-[11px]">
            <div className="flex w-40 flex-col items-center sm:w-52">
              <div
                className="w-full border-t pt-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ borderColor: GRAY, color: GRAY }}
              >
                Customer Signature
              </div>
            </div>

            <div className="flex w-40 flex-col items-center sm:w-52">
              <div
                className="text-center text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: INK }}
              >
                For {settings.company.name}
              </div>
              {settings.company.stampUrl ? (
                <img
                  src={settings.company.stampUrl}
                  alt="Company stamp"
                  className="my-1.5 h-20 w-auto max-w-[110px] object-contain"
                />
              ) : (
                <div className="h-[86px]" />
              )}
              <div
                className="w-full border-t pt-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ borderColor: GRAY, color: GRAY }}
              >
                Authorized Signatory
              </div>
            </div>
          </div>

          <div
            style={{ fontFamily: SERIF, color: RED }}
            className="pb-6 pt-7 text-center text-[15px] italic"
          >
            Thank you for choosing {settings.company.name}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="relative z-10 border-t px-4 py-3.5 text-center text-[8.5px] uppercase tracking-[0.06em]"
          style={{ borderColor: HAIR, color: GRAY }}
        >
          {[
            settings.company.address,
            settings.company.phones && `Ph: ${settings.company.phones}`,
            settings.company.email,
            settings.company.website,
          ]
            .filter(Boolean)
            .join("  |  ")}
        </div>
        <div style={{ background: RED }} className="relative z-10 h-[3px]" />
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: RED }}>
      {children}
    </div>
  );
}

function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <SectionLabel>{children}</SectionLabel>
      <span className="h-px flex-1" style={{ background: HAIR }} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: GRAY }}>
        {label}
      </div>
      <div className="mt-0.5 font-medium" style={{ color: INK }}>
        {value}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2" style={{ borderColor: HAIR }}>
      <span style={{ color: GRAY }}>{label}</span>
      <span style={{ color: INK }}>{value}</span>
    </div>
  );
}
