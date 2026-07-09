import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import type { AppSettings, Quotation } from "./types";
import { formatNum, formatDate } from "./format";
import { urlToDataUrl } from "./storage";

// ─── Brand colours ───────────────────────────────────────────────────────────
const RED: [number, number, number] = [232, 72, 77];
const DARK: [number, number, number] = [28, 28, 38];      // header bg
const DARK_MID: [number, number, number] = [45, 45, 58];  // sub-header bg
const WHITE: [number, number, number] = [255, 255, 255];
const LIGHT_GRAY: [number, number, number] = [247, 247, 250];
const MID_GRAY: [number, number, number] = [200, 200, 210];
const TEXT: [number, number, number] = [35, 35, 45];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** jsPDF-safe Indian rupee formatter — uses "Rs." not "₹" (Helvetica can't render ₹) */
function pdfINR(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  const s = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  // strip any non-ASCII characters (Intl can emit narrow no-break space etc.)
  return `Rs. ${s.replace(/[^\x20-\x7E,. ]/g, "")}`;
}

function pdfNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) n = 0;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(n)
    .replace(/[^\x20-\x7E,. ]/g, "");
}

/** Strip non-ASCII characters from any user-supplied string before putting in PDF */
function safe(s: string | undefined | null): string {
  return (s ?? "").replace(/[^\x20-\x7E]/g, (ch) => {
    // Replace common Unicode punctuation with ASCII equivalents
    const map: Record<string, string> = {
      "\u2014": "--",  // em dash
      "\u2013": "-",   // en dash
      "\u2018": "'",   // left single quote
      "\u2019": "'",   // right single quote
      "\u201C": '"',   // left double quote
      "\u201D": '"',   // right double quote
      "\u20B9": "Rs.", // rupee sign
      "\u2022": "*",   // bullet
      "\u25CF": "*",   // black circle
      "\u2026": "...", // ellipsis
    };
    return map[ch] ?? "";
  });
}

const APP_LOGO_URL = "/logo.png";

interface ImageCache {
  [url: string]: string | null;
}

async function loadImages(quote: Quotation, settings: AppSettings): Promise<ImageCache> {
  const cache: ImageCache = {};
  const urls = new Set<string>();
  if (settings.company.logoUrl) urls.add(settings.company.logoUrl);
  urls.add(APP_LOGO_URL);
  for (const it of quote.items) if (it.imageUrl) urls.add(it.imageUrl);
  await Promise.all(
    [...urls].map(async (u) => {
      cache[u] = await urlToDataUrl(u);
    }),
  );
  return cache;
}

// ─── Main PDF generator ───────────────────────────────────────────────────────

export async function generateQuotationPdf(
  quote: Quotation,
  settings: AppSettings,
): Promise<Blob> {
  const images = await loadImages(quote, settings);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  // ── HEADER BAR (full dark background) ─────────────────────────────────────
  const headerH = 38;
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, headerH, "F");

  // Red accent stripe at bottom of header
  doc.setFillColor(...RED);
  doc.rect(0, headerH - 1.5, pageW, 1.5, "F");

  // Company name (left side of header)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  doc.text(safe(settings.company.name || "Company Name"), margin, 11);

  // Company details below name (header, left)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 215);
  const compDetails = [
    settings.company.address,
    settings.company.phones && `Ph: ${settings.company.phones}`,
    settings.company.email && `Email: ${settings.company.email}`,
    settings.company.website,
    settings.company.gst && `GSTIN: ${settings.company.gst}`,
  ]
    .filter(Boolean)
    .map(safe);

  let cy = 17;
  for (const line of compDetails.slice(0, 3)) {
    doc.text(line, margin, cy);
    cy += 4.2;
  }

  // Logo (right side of header)
  const logoData =
    (settings.company.logoUrl && images[settings.company.logoUrl]) ||
    images[APP_LOGO_URL];
  if (logoData) {
    try {
      const logoW = 44;
      const logoH = 18;
      const lx = pageW - margin - logoW;
      const ly = (headerH - logoH) / 2 - 1;
      doc.addImage(logoData, "PNG", lx, ly, logoW, logoH, undefined, "FAST");
    } catch {
      // silently ignore broken images
    }
  }

  // ── CLIENT + QUOTE META STRIP ──────────────────────────────────────────────
  const stripH = 22;
  doc.setFillColor(...DARK_MID);
  doc.rect(0, headerH, pageW, stripH, "F");

  // "To:" client info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 165, 190);
  doc.text("BILL TO", margin, headerH + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(safe(quote.clientSnapshot.name), margin, headerH + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(195, 200, 220);
  const clientDetail = [
    quote.clientSnapshot.org,
    quote.clientSnapshot.phone && `Mobile: ${quote.clientSnapshot.phone}`,
    quote.clientSnapshot.email,
    [quote.clientSnapshot.city, quote.clientSnapshot.state].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .map(safe)
    .join("   |   ");
  doc.text(clientDetail, margin, headerH + 17);

  // Quote number + date (right side of strip)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 165, 190);
  doc.text("QUOTE NO", pageW - margin - 55, headerH + 5.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(safe(quote.number), pageW - margin - 55, headerH + 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 165, 190);
  doc.text("DATE", pageW - margin - 20, headerH + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(safe(formatDate(quote.date)), pageW - margin - 20, headerH + 11);

  if (settings.company.salesPerson) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(160, 165, 190);
    doc.text("SALES BY", pageW - margin - 55, headerH + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...WHITE);
    doc.text(safe(settings.company.salesPerson), pageW - margin - 20, headerH + 17, { align: "right" });
  }

  // ── DOCUMENT TITLE ─────────────────────────────────────────────────────────
  const titleY = headerH + stripH + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...RED);
  doc.text(safe(settings.docTitle.toUpperCase()), pageW / 2, titleY, { align: "center" });
  // Underline
  const titleText = settings.docTitle.toUpperCase();
  const titleW = doc.getStringUnitWidth(titleText) * 15 * 0.352778;
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.8);
  doc.line(pageW / 2 - titleW / 2, titleY + 1.5, pageW / 2 + titleW / 2, titleY + 1.5);

  // ── ITEMS TABLE ────────────────────────────────────────────────────────────
  const rowImgH = 24;
  const body = quote.items.map((it, idx) => {
    const lines: string[] = [];
    lines.push(`[${safe(it.code)}] ${safe(it.name)}`);
    if (it.location) lines.push(`Location: ${safe(it.location)}`);
    const mf = [it.material, it.finish].filter(Boolean).map(safe).join(" / ");
    if (mf) lines.push(mf);
    if (it.steps) lines.push(`Steps: ${it.steps}`);
    for (const s of it.specs) if (s.trim()) lines.push(`* ${safe(s)}`);
    if (it.weight) lines.push(`Weight: ${pdfNum(it.weight, 2)} Kg`);
    return [
      String(idx + 1),
      { content: lines.join("\n"), _img: it.imageUrl },
      it.width ? String(it.width) : "-",
      it.height ? String(it.height) : "-",
      String(it.qty),
      it.rateMode === "lumpsum" ? "-" : pdfNum(it.measureValue * it.qty, 2),
      it.rateMode === "lumpsum" ? "Lump Sum" : pdfNum(it.rate, 2),
      pdfNum(it.amount, 2),
    ];
  });

  autoTable(doc, {
    startY: titleY + 5,
    head: [["#", "Description", "Width", "Height", "Qty", "Sqft/Rft", "Rate (Rs.)", "Amount (Rs.)"]],
    body: body as never,
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: MID_GRAY,
      lineWidth: 0.2,
      textColor: TEXT,
      valign: "middle",
    },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: "bold",
      halign: "center",
      fontSize: 8.5,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: LIGHT_GRAY,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 72 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 10, halign: "center" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 32, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const raw = data.cell.raw as { _img?: string } | undefined;
        if (raw?._img && images[raw._img]) {
          data.cell.styles.minCellHeight = rowImgH + 6;
          (data.cell.styles as unknown as { cellPadding: unknown }).cellPadding = {
            top: 2,
            right: 2,
            bottom: 2,
            left: 28,
          };
        }
      }
    },
    didDrawCell: (data: CellHookData) => {
      if (data.section === "body" && data.column.index === 1) {
        const raw = data.cell.raw as { _img?: string } | undefined;
        const url = raw?._img;
        if (url && images[url]) {
          try {
            doc.addImage(
              images[url] as string,
              "JPEG",
              data.cell.x + 1.5,
              data.cell.y + 1.5,
              24,
              rowImgH,
              undefined,
              "FAST",
            );
          } catch { /* ignore */ }
        }
      }
    },
  });

  // ── TOTALS ROW (TOTAL bar) ────────────────────────────────────────────────
  interface JsPdfWithAt extends jsPDF {
    lastAutoTable?: { finalY: number };
  }
  let y = (doc as JsPdfWithAt).lastAutoTable?.finalY ?? titleY + 20;
  y += 2;

  autoTable(doc, {
    startY: y,
    body: [
      ["", "TOTAL", "", "", String(quote.totals.itemCount), pdfNum(quote.totals.area, 2), "", pdfNum(quote.subTotal, 2)],
    ],
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      fontStyle: "bold",
      fillColor: [230, 230, 238],
      textColor: TEXT,
      lineColor: MID_GRAY,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 72 },
      2: { cellWidth: 14 },
      3: { cellWidth: 14 },
      4: { cellWidth: 10, halign: "center" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 22 },
      7: { cellWidth: 32, halign: "right" },
    },
  });
  y = (doc as JsPdfWithAt).lastAutoTable?.finalY ?? y + 8;
  y += 5;

  // ── BOTTOM SECTION: Summary left | Totals right ───────────────────────────
  const boxTop = y;
  const leftW = contentW * 0.52;
  const rightW2 = contentW * 0.48;
  const rightX2 = margin + leftW;
  const rowH = 7;

  // LEFT — summary stats + bank
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  let ly = boxTop + 1;

  const summaryLines = [
    `Total Items   : ${quote.totals.itemCount}`,
    `Total Area    : ${pdfNum(quote.totals.area, 2)} sqft`,
    `Total Weight  : ${pdfNum(quote.totals.weight, 2)} Kg`,
  ];
  for (const l of summaryLines) {
    doc.text(l, margin, ly + 4);
    ly += 5.5;
  }

  // Bank details heading
  ly += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...RED);
  doc.text("BANK DETAILS", margin, ly);
  ly += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  const bankLines = [
    settings.bank.accountName && `A/C Name : ${settings.bank.accountName}`,
    settings.bank.bankName    && `Bank     : ${settings.bank.bankName}`,
    settings.bank.branch      && `Branch   : ${settings.bank.branch}`,
    settings.bank.accountNo   && `A/C No   : ${settings.bank.accountNo}`,
    settings.bank.ifsc        && `IFSC     : ${settings.bank.ifsc}`,
  ].filter(Boolean).map(safe);
  for (const l of bankLines) {
    doc.text(l, margin, ly);
    ly += 4;
  }

  // RIGHT — totals breakdown
  let ty = boxTop;
  const totalsData: [string, string, boolean][] = [
    ["Sub Total", pdfINR(quote.subTotal), false],
    [
      `Discount${quote.discount.mode === "percent" ? ` (${quote.discount.value}%)` : ""}`,
      `- ${pdfINR(quote.discountAmt)}`,
      false,
    ],
    [`GST @ ${quote.gstPercent}%`, pdfINR(quote.gstAmt), false],
  ];

  doc.setLineWidth(0.2);
  doc.setDrawColor(...MID_GRAY);

  for (const [label, value] of totalsData) {
    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(rightX2, ty, rightW2, rowH, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(safe(label), rightX2 + 3, ty + 4.8);
    doc.text(safe(value), rightX2 + rightW2 - 3, ty + 4.8, { align: "right" });
    ty += rowH;
  }

  // Grand Total row — bold red background
  const gtH = rowH + 2;
  doc.setFillColor(...RED);
  doc.rect(rightX2, ty, rightW2, gtH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...WHITE);
  doc.text("GRAND TOTAL", rightX2 + 3, ty + 5.5);
  doc.text(pdfINR(quote.grandTotal), rightX2 + rightW2 - 3, ty + 5.5, { align: "right" });
  ty += gtH;

  // Avg price row
  doc.setFillColor(220, 220, 230);
  doc.rect(rightX2, ty, rightW2, rowH, "FD");
  const avg = quote.totals.area > 0 ? quote.grandTotal / quote.totals.area : 0;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  doc.text("Avg Price / sqft", rightX2 + 3, ty + 4.8);
  doc.text(pdfINR(avg), rightX2 + rightW2 - 3, ty + 4.8, { align: "right" });
  ty += rowH;

  y = Math.max(ly, ty) + 8;

  // ── LOADING NOTICE ────────────────────────────────────────────────────────
  const ensureSpace = (need: number) => {
    if (y + need > pageH - 22) {
      doc.addPage();
      y = margin + 5;
    }
  };

  ensureSpace(10);
  doc.setFillColor(255, 243, 243);
  const noticeText = `* ${safe(settings.loadingNotice)}`;
  const noticeLines = doc.splitTextToSize(noticeText, contentW - 6);
  const noticeH = noticeLines.length * 4.5 + 4;
  doc.rect(margin, y, contentW, noticeH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...RED);
  doc.text(noticeLines, margin + 3, y + 5);
  y += noticeH + 5;

  // ── PAYMENT TERMS ─────────────────────────────────────────────────────────
  ensureSpace(22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text("PAYMENT TERMS", margin, y);
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 1, margin + 33, y + 1);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...TEXT);
  const ptLines = doc.splitTextToSize(safe(settings.paymentTerms), contentW);
  ensureSpace(ptLines.length * 4.2 + 4);
  doc.text(ptLines, margin, y);
  y += ptLines.length * 4.2 + 5;

  // ── TERMS & CONDITIONS ────────────────────────────────────────────────────
  ensureSpace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text("TERMS & CONDITIONS", margin, y);
  doc.setDrawColor(...RED);
  doc.line(margin, y + 1, margin + 43, y + 1);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...TEXT);
  settings.termsAndConditions.forEach((t, i) => {
    const wrapped = doc.splitTextToSize(`${i + 1}. ${safe(t)}`, contentW);
    ensureSpace(wrapped.length * 4.2 + 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.2 + 1.5;
  });
  y += 4;

  // ── ACCEPTANCE + SIGNATURES ───────────────────────────────────────────────
  ensureSpace(28);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 110);
  const accept = doc.splitTextToSize(
    "I hereby accept the estimate as per above mentioned price and specifications.",
    contentW,
  );
  doc.text(accept, margin, y);
  y += accept.length * 4.5 + 10;

  doc.setDrawColor(...DARK_MID);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + 55, y);
  doc.line(pageW - margin - 55, y, pageW - margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  doc.text("Authorized Signatory", margin, y + 4.5);
  doc.text("Signature of Customer", pageW - margin, y + 4.5, { align: "right" });

  // ── PAGE FOOTER ────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Footer bar
    doc.setFillColor(...DARK);
    doc.rect(0, pageH - 10, pageW, 10, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 185, 210);
    doc.text(safe(quote.number), margin, pageH - 3.5);
    doc.text(safe(settings.company.name), pageW / 2, pageH - 3.5, { align: "center" });
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 3.5, { align: "right" });
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
