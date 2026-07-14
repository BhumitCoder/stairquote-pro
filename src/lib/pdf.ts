import { jsPDF, GState } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import type { AppSettings, Invoice, Quotation } from "./types";
import { formatDate } from "./format";
import { BRAND_TAGLINE } from "./settings-defaults";
import { urlToDataUrl } from "./storage";

// ─── Brand colours — clean white letterhead, red used only as an accent ──────
const RED: [number, number, number] = [232, 72, 77];
const TEXT: [number, number, number] = [35, 35, 45];
const GRAY: [number, number, number] = [125, 128, 145];
const LINE: [number, number, number] = [222, 222, 230];
const PANEL: [number, number, number] = [249, 249, 251];
const WHITE: [number, number, number] = [255, 255, 255];

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

/** Strip non-ASCII characters (but keep line breaks) from any user-supplied string */
function safe(s: string | undefined | null): string {
  return (s ?? "").replace(/[^\x20-\x7E\n]/g, (ch) => {
    // Replace common Unicode punctuation with ASCII equivalents
    const map: Record<string, string> = {
      "\u2014": "--", // em dash
      "\u2013": "-", // en dash
      "\u2018": "'", // left single quote
      "\u2019": "'", // right single quote
      "\u201C": '"', // left double quote
      "\u201D": '"', // right double quote
      "\u20B9": "Rs.", // rupee sign
      "\u2022": "*", // bullet
      "\u25CF": "*", // black circle
      "\u2026": "...", // ellipsis
    };
    return map[ch] ?? "";
  });
}

const APP_LOGO_URL = "/logo.png";

interface ImageCache {
  [url: string]: string | null;
}

async function loadImages(quote: Quotation | Invoice): Promise<ImageCache> {
  const cache: ImageCache = {};
  const urls = new Set<string>();
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

// Renders both quotations and bills (tax invoices) — pass either document.
// Layout is a clean, minimal white letterhead: plenty of whitespace, thin
// hairline rules, and a single red accent — built to feel simple and
// trustworthy to a client rather than "designed".
export async function generateQuotationPdf(
  quote: Quotation | Invoice,
  settings: AppSettings,
): Promise<Blob> {
  const inv = "payments" in quote ? (quote as Invoice) : null;
  const images = await loadImages(quote);
  const logoData = images[APP_LOGO_URL];
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;

  // ── HEADER — plain white letterhead: title left, logo right ───────────────
  const titleText = inv ? "TAX INVOICE" : settings.docTitle.toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...TEXT);
  doc.text(safe(titleText), margin, 20);

  // Small red accent rule under the title
  doc.setFillColor(...RED);
  doc.rect(margin, 23.5, 16, 1.1, "F");

  // Logo, top-right — the logo already carries the full wordmark, so nothing
  // else needs to be duplicated next to it.
  if (logoData) {
    try {
      const logoW = 44;
      const logoH = (logoW * 457) / 1152;
      doc.addImage(
        logoData,
        "PNG",
        pageW - margin - logoW,
        14 - logoH / 2 + 4,
        logoW,
        logoH,
        undefined,
        "FAST",
      );
    } catch {
      // silently ignore broken images
    }
  }

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.line(margin, 32, pageW - margin, 32);

  // ── CLIENT + META ROW ──────────────────────────────────────────────────────
  const clientAddress = [
    quote.clientSnapshot.address,
    quote.clientSnapshot.city,
    quote.clientSnapshot.state,
  ]
    .filter(Boolean)
    .join(", ");
  const detailMaxW = contentW - 62;
  const clientLines = [
    quote.clientSnapshot.org,
    quote.clientSnapshot.phone && `Mobile: ${quote.clientSnapshot.phone}`,
    quote.clientSnapshot.email,
    clientAddress,
  ]
    .filter(Boolean)
    .map((l) => safe(l as string))
    .flatMap((l) => doc.splitTextToSize(l, detailMaxW) as string[]);

  let y = 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("TO,", margin, y);

  // Right column: quote/bill no + date, aligned with the "TO," row
  const rightX = pageW - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(inv ? "BILL NO" : "QUOTE NO", rightX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT);
  doc.text(safe(quote.number), rightX, y + 5, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("DATE", rightX, y + 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT);
  doc.text(safe(formatDate(quote.date)), rightX, y + 16, { align: "right" });

  let ry = y + 16;
  if (inv?.quotationNumber) {
    ry += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("REF. QUOTATION", rightX, ry - 5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(safe(inv.quotationNumber), rightX, ry, { align: "right" });
  }
  if (settings.company.salesPerson) {
    ry += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("SALES BY", rightX, ry - 5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(safe(settings.company.salesPerson), rightX, ry, { align: "right" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...TEXT);
  doc.text(safe(quote.clientSnapshot.name), margin, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  let cy = y + 11.5;
  for (const line of clientLines) {
    doc.text(line, margin, cy);
    cy += 4.4;
  }

  y = Math.max(cy, ry + 4) + 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Section heading: small red accent bar + bold title + hairline divider.
  const sectionHeading = (title: string) => {
    doc.setFillColor(...RED);
    doc.rect(margin, y - 3.4, 1.2, 4.4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(title, margin + 3.6, y);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2.6, margin + contentW, y + 2.6);
    y += 8.5;
  };

  sectionHeading("ITEM DESCRIPTION");
  const tableStartY = y;

  // ── ITEMS TABLE — plain grid, no dark fills ────────────────────────────────
  const rowImgH = 24;
  const SPEC_LINE_H = 3.6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const body = quote.items.map((it, idx) => {
    const lines: string[] = [];
    lines.push(safe(it.name));
    if (it.location) lines.push(`Location: ${safe(it.location)}`);
    const mf = [it.material, it.finish].filter(Boolean).map(safe).join(" / ");
    if (mf) lines.push(mf);
    if (it.steps) lines.push(`Steps: ${it.steps}`);
    if (it.weight) lines.push(`Weight: ${pdfNum(it.weight, 2)} Kg`);

    const specTexts = it.specs.filter((s) => s.trim()).map((s) => `- ${safe(s)}`);
    const hasImg = !!(it.imageUrl && images[it.imageUrl]);
    let specLines: string[] = [];
    if (hasImg) {
      // With a photo, specs render manually below it across the full cell width.
      specLines = specTexts.flatMap((s) => doc.splitTextToSize(s, 58) as string[]);
    } else {
      lines.push(...specTexts); // no photo — the whole cell is already full-width
    }

    return [
      String(idx + 1),
      { content: lines.join("\n"), _img: hasImg ? it.imageUrl : undefined, _specs: specLines },
      it.width ? String(it.width) : "-",
      it.height ? String(it.height) : "-",
      String(it.qty),
      it.rateMode === "lumpsum" ? "-" : pdfNum(it.measureValue * it.qty, 2),
      it.rateMode === "lumpsum" ? "Lump Sum" : pdfNum(it.rate, 2),
      pdfNum(it.amount, 2),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Description", "Width", "Height", "Qty", "Sqft/Rft", "Rate", "Amount"]],
    body: body as never,
    // Never slice an item row in half — move the whole row to the next page.
    rowPageBreak: "avoid",
    // Keep table rows clear of the footer.
    margin: { left: margin, right: margin, bottom: 20 },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: LINE,
      lineWidth: 0.15,
      textColor: TEXT,
      valign: "middle",
    },
    headStyles: {
      fillColor: WHITE,
      textColor: TEXT,
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
      lineColor: TEXT,
      lineWidth: { bottom: 0.5, top: 0, left: 0.15, right: 0.15 } as never,
      cellPadding: { top: 3, bottom: 3, left: 1, right: 1 },
    },
    alternateRowStyles: {
      fillColor: PANEL,
    },
    // Widths must sum to contentW and leave every header on a single line.
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: contentW - 8 - 16 - 15 - 12 - 20 - 23 - 33 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 23, halign: "right" },
      7: { cellWidth: 33, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const raw = data.cell.raw as { _img?: string; _specs?: string[] } | undefined;
        if (raw?._img) {
          // Photo on the left, main details beside it; the bottom of the cell is
          // reserved so the specs can span the full width under the photo.
          const specs = raw._specs ?? [];
          const specBlockH = specs.length ? specs.length * SPEC_LINE_H + 3 : 0;
          data.cell.styles.minCellHeight = rowImgH + 6 + specBlockH;
          (data.cell.styles as unknown as { cellPadding: unknown }).cellPadding = {
            top: 2,
            right: 2,
            bottom: 2 + specBlockH,
            left: 28,
          };
        }
      }
    },
    didDrawCell: (data: CellHookData) => {
      if (data.section === "body" && data.column.index === 1) {
        const raw = data.cell.raw as { _img?: string; _specs?: string[] } | undefined;
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
          } catch {
            /* ignore */
          }
        }
        const specs = raw?._specs ?? [];
        if (specs.length) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...TEXT);
          let sy = data.cell.y + data.cell.height - specs.length * SPEC_LINE_H - 2.5 + 3;
          for (const line of specs) {
            doc.text(line, data.cell.x + 2.5, sy);
            sy += SPEC_LINE_H;
          }
        }
      }
    },
  });

  // ── TOTAL ROW ──────────────────────────────────────────────────────────────
  interface JsPdfWithAt extends jsPDF {
    lastAutoTable?: { finalY: number };
  }
  y = (doc as JsPdfWithAt).lastAutoTable?.finalY ?? tableStartY + 20;
  y += 2;

  autoTable(doc, {
    startY: y,
    body: [
      [
        "",
        "TOTAL",
        "",
        "",
        String(quote.totals.itemCount),
        pdfNum(quote.totals.area, 2),
        "",
        pdfNum(quote.subTotal, 2),
      ],
    ],
    margin: { left: margin, right: margin, bottom: 20 },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      fontStyle: "bold",
      fillColor: PANEL,
      textColor: TEXT,
      lineColor: LINE,
      lineWidth: 0.15,
    },
    // Keep in sync with the items-table columnStyles above so columns align.
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: contentW - 8 - 16 - 15 - 12 - 20 - 23 - 33 },
      2: { cellWidth: 16 },
      3: { cellWidth: 15 },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 23 },
      7: { cellWidth: 33, halign: "right" },
    },
  });
  y = (doc as JsPdfWithAt).lastAutoTable?.finalY ?? y + 8;
  y += 9;

  // Break to a new page only when a block genuinely doesn't fit above the
  // footer — otherwise keep filling the page.
  const FOOTER_H = 18;
  const ensureSpace = (need: number) => {
    if (y + need > pageH - FOOTER_H) {
      doc.addPage();
      y = margin + 5;
    }
  };

  // ── PROJECT COSTING ────────────────────────────────────────────────────────
  ensureSpace(inv ? 58 : 42);
  sectionHeading("PROJECT COSTING");
  const boxTop = y;
  const leftW = contentW * 0.5;
  const rightW2 = contentW * 0.46;
  const rightX2 = margin + contentW - rightW2;
  const rowH = 6.6;

  // LEFT — summary stats (+ bank details on bills)
  let ly = boxTop + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  const summaryLines = [
    `Total Items   : ${quote.totals.itemCount}`,
    `Total Area    : ${pdfNum(quote.totals.area, 2)} sqft`,
    `Total Weight  : ${pdfNum(quote.totals.weight, 2)} Kg`,
  ];
  for (const l of summaryLines) {
    doc.text(l, margin, ly + 4);
    ly += 5.5;
  }

  if (inv) {
    const bankLines = [
      settings.bank.accountName && `A/C Name : ${settings.bank.accountName}`,
      settings.bank.bankName && `Bank     : ${settings.bank.bankName}`,
      settings.bank.branch && `Branch   : ${settings.bank.branch}`,
      settings.bank.accountNo && `A/C No   : ${settings.bank.accountNo}`,
      settings.bank.ifsc && `IFSC     : ${settings.bank.ifsc}`,
      settings.bank.upiId && `UPI      : ${settings.bank.upiId}`,
    ]
      .filter(Boolean)
      .map((l) => safe(l as string));
    if (bankLines.length > 0) {
      ly += 3.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...RED);
      doc.text("BANK / PAYMENT DETAILS", margin, ly);
      ly += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT);
      for (const l of bankLines) {
        doc.text(l, margin, ly);
        ly += 4;
      }
    }
  }

  // RIGHT — totals breakdown, plain rows separated by hairlines
  let ty = boxTop;
  const totalsData: [string, string][] = [
    ["Sub Total", pdfINR(quote.subTotal)],
    [
      `Discount${quote.discount.mode === "percent" ? ` (${quote.discount.value}%)` : ""}`,
      `- ${pdfINR(quote.discountAmt)}`,
    ],
    [`GST @ ${quote.gstPercent}%`, pdfINR(quote.gstAmt)],
  ];

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  for (const [label, value] of totalsData) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(safe(label), rightX2, ty + 4.6);
    doc.text(safe(value), rightX2 + rightW2, ty + 4.6, { align: "right" });
    doc.line(rightX2, ty + rowH, rightX2 + rightW2, ty + rowH);
    ty += rowH;
  }

  // Grand Total — bold, flanked by a heavier red rule
  ty += 1;
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.6);
  doc.line(rightX2, ty, rightX2 + rightW2, ty);
  ty += 5.2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...RED);
  doc.text("GRAND TOTAL", rightX2, ty);
  doc.text(pdfINR(quote.grandTotal), rightX2 + rightW2, ty, { align: "right" });
  ty += 2.4;
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.6);
  doc.line(rightX2, ty, rightX2 + rightW2, ty);
  ty += 5.5;

  // Bills: amount received + balance due
  if (inv) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(16, 122, 87);
    doc.text("Received", rightX2, ty + 4.6);
    doc.text(`- ${pdfINR(inv.amountPaid)}`, rightX2 + rightW2, ty + 4.6, { align: "right" });
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(rightX2, ty + rowH, rightX2 + rightW2, ty + rowH);
    ty += rowH + 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text("BALANCE DUE", rightX2, ty + 4.6);
    doc.text(pdfINR(inv.balanceDue), rightX2 + rightW2, ty + 4.6, { align: "right" });
    doc.setDrawColor(...TEXT);
    doc.setLineWidth(0.4);
    doc.line(rightX2, ty + rowH + 1, rightX2 + rightW2, ty + rowH + 1);
    ty += rowH + 3;
  }

  // Avg price row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  const avg = quote.totals.area > 0 ? quote.grandTotal / quote.totals.area : 0;
  doc.text("Avg Price / sqft", rightX2, ty + 4);
  doc.text(pdfINR(avg), rightX2 + rightW2, ty + 4, { align: "right" });
  ty += rowH;

  y = Math.max(ly, ty) + 6;
  void leftW; // reserved for future left-column width tuning

  // ── PAYMENT CONDITION — quotations only; a bill shows actual payments instead ──
  if (!inv && settings.paymentTerms.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const ptRows = safe(settings.paymentTerms)
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((r) => doc.splitTextToSize(r, contentW - 18) as string[]);
    const rowHs = ptRows.map((w) => w.length * 4.6 + 3);
    const panelH = rowHs.reduce((a, b) => a + b, 0) + 4;
    ensureSpace(9 + panelH + 4);
    sectionHeading("PAYMENT CONDITION");
    doc.setFillColor(...PANEL);
    doc.roundedRect(margin, y, contentW, panelH, 1.8, 1.8, "F");
    let ry2 = y + 6.2;
    for (let i = 0; i < ptRows.length; i++) {
      doc.setFillColor(...RED);
      doc.circle(margin + 5.5, ry2 - 1.3, 0.9, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(ptRows[i], margin + 10, ry2);
      ry2 += rowHs[i];
    }
    y += panelH + 8;
  }

  // ── PAYMENT HISTORY (bills only) ──────────────────────────────────────────
  if (inv && inv.payments.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.6);
    const payRows = inv.payments.map((p) => {
      const left = safe(`${formatDate(p.date)}   |   ${p.mode}${p.note ? ` -- ${p.note}` : ""}`);
      return {
        lines: doc.splitTextToSize(left, contentW - 55) as string[],
        amount: pdfINR(p.amount),
      };
    });
    const rowHs = payRows.map((r) => r.lines.length * 4.4 + 3);
    const panelH = rowHs.reduce((a, b) => a + b, 0) + 4;
    ensureSpace(9 + panelH + 4);
    sectionHeading("PAYMENT HISTORY");
    doc.setFillColor(...PANEL);
    doc.roundedRect(margin, y, contentW, panelH, 1.8, 1.8, "F");
    let py = y + 6.2;
    for (let i = 0; i < payRows.length; i++) {
      doc.setFillColor(...RED);
      doc.circle(margin + 5.5, py - 1.3, 0.9, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.6);
      doc.setTextColor(...TEXT);
      doc.text(payRows[i].lines, margin + 10, py);
      doc.setFont("helvetica", "bold");
      doc.text(payRows[i].amount, margin + contentW - 4.5, py, { align: "right" });
      py += rowHs[i];
    }
    y += panelH + 8;
  }

  // ── TERMS & CONDITIONS — quotations only ───────────────────────────────────
  const terms = inv ? [] : settings.termsAndConditions.filter((t) => t.trim());
  if (terms.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    const panelPad = 5.5;
    const colGap = 10;
    const colW = (contentW - panelPad * 2 - colGap) / 2;
    const wrapped = terms.map((t) => doc.splitTextToSize(safe(t), colW - 6) as string[]);
    const itemHs = wrapped.map((w) => w.length * 4.1 + 2.8);
    const totalH = itemHs.reduce((a, b) => a + b, 0);

    // Split items into two columns as evenly as possible (keeping order).
    let acc = 0;
    let splitIdx = terms.length;
    for (let i = 0; i < terms.length; i++) {
      if (acc + itemHs[i] / 2 >= totalH / 2) {
        splitIdx = i;
        break;
      }
      acc += itemHs[i];
    }
    const leftH = itemHs.slice(0, splitIdx).reduce((a, b) => a + b, 0);
    const rightH = itemHs.slice(splitIdx).reduce((a, b) => a + b, 0);
    const colsH = Math.max(leftH, rightH);

    const drawTerm = (idx: number, x: number, ty2: number): number => {
      doc.setFillColor(...RED);
      doc.circle(x + 1, ty2 - 1.2, 0.9, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.3);
      doc.setTextColor(...TEXT);
      doc.text(wrapped[idx], x + 4.5, ty2);
      return itemHs[idx];
    };

    if (colsH <= pageH - margin - FOOTER_H - 24) {
      const panelH = colsH + panelPad * 1.6;
      ensureSpace(9 + panelH + 4);
      sectionHeading("TERMS & CONDITIONS");
      doc.setFillColor(...PANEL);
      doc.roundedRect(margin, y, contentW, panelH, 1.8, 1.8, "F");
      let cy2 = y + panelPad + 1.5;
      for (let i = 0; i < splitIdx; i++) cy2 += drawTerm(i, margin + panelPad, cy2);
      cy2 = y + panelPad + 1.5;
      for (let i = splitIdx; i < terms.length; i++)
        cy2 += drawTerm(i, margin + panelPad + colW + colGap, cy2);
      y += panelH + 8;
    } else {
      // Very long list — single column, item by item, nothing ever cut.
      ensureSpace(9 + itemHs[0] + 2);
      sectionHeading("TERMS & CONDITIONS");
      let cy2 = y + 2;
      for (let i = 0; i < terms.length; i++) {
        if (cy2 + itemHs[i] > pageH - FOOTER_H) {
          doc.addPage();
          cy2 = margin + 7;
        }
        cy2 += drawTerm(i, margin, cy2);
      }
      y = cy2 + 5;
    }
  }

  // ── ACCEPTANCE + SIGNATURES ───────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  const accept = doc.splitTextToSize(
    inv
      ? "Received the above goods / services in good order and condition."
      : "I hereby accept the estimate as per above mentioned price and specifications.",
    contentW,
  ) as string[];
  ensureSpace(accept.length * 4.5 + 26 + 10);
  doc.setTextColor(...GRAY);
  doc.text(accept, margin, y);
  y += accept.length * 4.5 + 14;

  const sigW = 62;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  doc.text(`For ${safe(settings.company.name)}`, pageW - margin, y - 2, { align: "right" });

  y += 8;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + sigW, y);
  doc.line(pageW - margin - sigW, y, pageW - margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Customer Signature & Date", margin, y + 4.2);
  doc.text("Authorized Signatory", pageW - margin, y + 4.2, { align: "right" });
  y += 12;

  // Thank-you line
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...RED);
  doc.text(`Thank you for choosing ${safe(settings.company.name)}!`, pageW / 2, y, {
    align: "center",
  });

  // ── WATERMARK + PAGE FOOTER ────────────────────────────────────────────────
  // The logo is already dark/coloured, so it can be stamped directly at very
  // low opacity as a centered watermark — no re-tinting needed on white paper.
  const footContact = [
    settings.company.address,
    settings.company.phones && `Ph: ${settings.company.phones}`,
    settings.company.email && `Email: ${settings.company.email}`,
    settings.company.website,
    settings.company.gst && `GSTIN: ${settings.company.gst}`,
  ]
    .filter(Boolean)
    .map((l) => safe(l as string).replace(/\n/g, " "))
    .join("   |   ");

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    if (logoData) {
      try {
        const wmW = 110;
        const wmH = (110 * 457) / 1152;
        doc.saveGraphicsState();
        doc.setGState(new GState({ opacity: 0.045 }));
        doc.addImage(
          logoData,
          "PNG",
          (pageW - wmW) / 2,
          (pageH - wmH) / 2,
          wmW,
          wmH,
          undefined,
          "FAST",
        );
        doc.restoreGraphicsState();
      } catch {
        // watermark is decorative — never fail the document for it
      }
    }

    // Footer: thin hairline, contact strip, then quote no / tagline / page no.
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 15, pageW - margin, pageH - 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...GRAY);
    const contactLines = (doc.splitTextToSize(footContact, contentW) as string[]).slice(0, 1);
    doc.text(contactLines, pageW / 2, pageH - 11, { align: "center" });

    doc.setFontSize(7);
    doc.text(safe(quote.number), margin, pageH - 5.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...RED);
    doc.text(safe(BRAND_TAGLINE), pageW / 2, pageH - 5.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 5.5, { align: "right" });
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
