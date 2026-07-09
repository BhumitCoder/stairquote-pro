import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import type { AppSettings, Quotation } from "./types";
import { formatDate } from "./format";
import { BRAND_TAGLINE } from "./settings-defaults";
import { urlToDataUrl } from "./storage";

// ─── Brand colours ───────────────────────────────────────────────────────────
const RED: [number, number, number] = [232, 72, 77];
const DARK: [number, number, number] = [28, 28, 38]; // header bg
const DARK_MID: [number, number, number] = [45, 45, 58]; // sub-header bg
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

async function loadImages(quote: Quotation): Promise<ImageCache> {
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

export async function generateQuotationPdf(quote: Quotation, settings: AppSettings): Promise<Blob> {
  const images = await loadImages(quote);
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
  doc.text(safe(settings.company.name || "Company Name"), margin, 10);

  // Brand tagline under the name
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...RED);
  doc.text(safe(BRAND_TAGLINE), margin, 14.5);

  // Address below (header, left) — one line per comma-separated part
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 215);
  const addressLines = safe(settings.company.address)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (settings.company.website) addressLines.push(safe(settings.company.website));

  let cy = 19.5;
  for (const line of addressLines.slice(0, 4)) {
    doc.text(line, margin, cy);
    cy += 4.2;
  }

  // Logo (top-right) with phone / email / GSTIN stacked underneath it
  const logoData = images[APP_LOGO_URL];
  const logoH = 15;
  if (logoData) {
    try {
      const logoW = 38;
      doc.addImage(logoData, "PNG", pageW - margin - logoW, 4, logoW, logoH, undefined, "FAST");
    } catch {
      // silently ignore broken images
    }
  }

  const contactLines = [
    settings.company.phones && `Ph: ${settings.company.phones}`,
    settings.company.email && `Email: ${settings.company.email}`,
    settings.company.gst && `GSTIN: ${settings.company.gst}`,
  ]
    .filter(Boolean)
    .map((l) => safe(l as string));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 215);
  let ry = logoData ? 4 + logoH + 4.5 : 11;
  for (const line of contactLines) {
    doc.text(line, pageW - margin, ry, { align: "right" });
    ry += 4.2;
  }

  // ── CLIENT + QUOTE META STRIP ──────────────────────────────────────────────
  // Client details stacked one per line; the strip grows to fit them.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const clientAddress = [
    quote.clientSnapshot.address,
    quote.clientSnapshot.city,
    quote.clientSnapshot.state,
  ]
    .filter(Boolean)
    .join(", ");
  const detailMaxW = pageW - margin * 2 - 62; // keep clear of the quote-no block on the right
  const clientLines = [
    quote.clientSnapshot.org,
    quote.clientSnapshot.phone && `Mobile: ${quote.clientSnapshot.phone}`,
    quote.clientSnapshot.email,
    clientAddress,
  ]
    .filter(Boolean)
    .map((l) => safe(l as string))
    .flatMap((l) => doc.splitTextToSize(l, detailMaxW) as string[]);

  const stripH = Math.max(22, 17.5 + clientLines.length * 4);
  doc.setFillColor(...DARK_MID);
  doc.rect(0, headerH, pageW, stripH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 165, 190);
  doc.text("CLIENT", margin, headerH + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(safe(quote.clientSnapshot.name), margin, headerH + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(195, 200, 220);
  let dy = headerH + 15.8;
  for (const line of clientLines) {
    doc.text(line, margin, dy);
    dy += 4;
  }

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
    doc.text(safe(settings.company.salesPerson), pageW - margin - 20, headerH + 17, {
      align: "right",
    });
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
  const SPEC_LINE_H = 3.6;
  // Pre-wrap spec lines at the description column's full width (63mm - padding).
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

    const specTexts = it.specs.filter((s) => s.trim()).map((s) => `* ${safe(s)}`);
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
    startY: titleY + 5,
    head: [["#", "Description", "Width", "Height", "Qty", "Sqft/Rft", "Rate", "Amount"]],
    body: body as never,
    // Never slice an item row in half — move the whole row to the next page.
    rowPageBreak: "avoid",
    // Keep table rows clear of the 10mm footer bar.
    margin: { left: margin, right: margin, bottom: 8 },
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
      cellPadding: { top: 3, bottom: 3, left: 1, right: 1 },
    },
    alternateRowStyles: {
      fillColor: LIGHT_GRAY,
    },
    // Widths must sum to contentW (190mm) and leave every header on a single line.
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 63 },
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

  // ── TOTALS ROW (TOTAL bar) ────────────────────────────────────────────────
  interface JsPdfWithAt extends jsPDF {
    lastAutoTable?: { finalY: number };
  }
  let y = (doc as JsPdfWithAt).lastAutoTable?.finalY ?? titleY + 20;
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
    margin: { left: margin, right: margin, bottom: 8 },
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
    // Keep in sync with the items-table columnStyles above so columns align.
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 63 },
      2: { cellWidth: 16 },
      3: { cellWidth: 15 },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 23 },
      7: { cellWidth: 33, halign: "right" },
    },
  });
  y = (doc as JsPdfWithAt).lastAutoTable?.finalY ?? y + 8;
  y += 5;

  // Break to a new page only when a block genuinely doesn't fit above the
  // footer bar (which starts at pageH - 10) — otherwise keep filling the page.
  const ensureSpace = (need: number) => {
    if (y + need > pageH - 8) {
      doc.addPage();
      y = margin + 5;
    }
  };

  // ── BOTTOM SECTION: Summary left | Totals right ───────────────────────────
  ensureSpace(38); // exact totals-box height — never split across pages
  const boxTop = y;
  const leftW = contentW * 0.52;
  const rightW2 = contentW * 0.48;
  const rightX2 = margin + leftW;
  const rowH = 7;

  // LEFT — summary stats
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

  // Section heading: small red accent bar + title + hairline divider.
  const sectionHeading = (title: string) => {
    doc.setFillColor(...RED);
    doc.rect(margin, y - 3.2, 1.3, 4.4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    doc.text(title, margin + 3.8, y);
    doc.setDrawColor(232, 232, 238);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2.4, margin + contentW, y + 2.4);
    y += 8;
  };

  // ── LOADING NOTICE (only when set) ────────────────────────────────────────
  if (settings.loadingNotice.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const noticeLines = doc.splitTextToSize(safe(settings.loadingNotice), contentW - 12);
    const noticeH = noticeLines.length * 4.5 + 5;
    ensureSpace(noticeH + 2);
    doc.setFillColor(255, 243, 243);
    doc.rect(margin, y, contentW, noticeH, "F");
    doc.setFillColor(...RED);
    doc.rect(margin, y, 1.3, noticeH, "F");
    doc.setTextColor(200, 45, 50);
    doc.text(noticeLines, margin + 5.5, y + 5.5);
    y += noticeH + 7;
  }

  // ── PAYMENT TERMS — soft panel, one bulleted row per line ─────────────────
  if (settings.paymentTerms.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    const ptRows = safe(settings.paymentTerms)
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((r) => doc.splitTextToSize(r, contentW - 16) as string[]);
    const rowHs = ptRows.map((w) => w.length * 4.2 + 2.8);
    const panelH = rowHs.reduce((a, b) => a + b, 0) + 3.5;

    if (panelH <= pageH - margin - 24) {
      // Keep heading + panel together on one page.
      ensureSpace(8 + panelH + 4);
      sectionHeading("PAYMENT TERMS");
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(margin, y, contentW, panelH, 1.6, 1.6, "F");
      let ry = y + 6;
      for (let i = 0; i < ptRows.length; i++) {
        doc.setFillColor(...RED);
        doc.circle(margin + 4.5, ry - 1.1, 0.8, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.4);
        doc.setTextColor(...TEXT);
        doc.text(ptRows[i], margin + 8.5, ry);
        ry += rowHs[i];
      }
      y += panelH + 7;
    } else {
      // Extremely long terms — flow line by line, never cutting anything.
      ensureSpace(8 + 10);
      sectionHeading("PAYMENT TERMS");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      doc.setTextColor(...TEXT);
      for (const row of ptRows) {
        for (const line of row) {
          ensureSpace(5);
          doc.text(line, margin + 3, y);
          y += 4.2;
        }
        y += 1;
      }
      y += 6;
    }
  }

  // ── TERMS & CONDITIONS — two balanced columns when they fit ───────────────
  const terms = settings.termsAndConditions.filter((t) => t.trim());
  if (terms.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    const colGap = 8;
    const panelPad = 4.5; // inner padding of the grey panel, like Payment Terms
    const colW = (contentW - panelPad * 2 - colGap) / 2;
    const wrapped = terms.map((t) => doc.splitTextToSize(safe(t), colW - 7) as string[]);
    const itemHs = wrapped.map((w) => w.length * 4 + 2.6);
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
      doc.circle(x + 1, ty2 - 1.1, 0.8, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      doc.setTextColor(...TEXT);
      doc.text(wrapped[idx], x + 4.5, ty2);
      return itemHs[idx];
    };

    if (colsH <= pageH - margin - 24) {
      // Two-column layout inside a soft grey panel, kept together with its heading.
      const panelH = colsH + 7.5;
      ensureSpace(8 + panelH + 4);
      sectionHeading("TERMS & CONDITIONS");
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(margin, y, contentW, panelH, 1.6, 1.6, "F");
      let cy2 = y + 6;
      for (let i = 0; i < splitIdx; i++) cy2 += drawTerm(i, margin + panelPad, cy2);
      cy2 = y + 6;
      for (let i = splitIdx; i < terms.length; i++)
        cy2 += drawTerm(i, margin + panelPad + colW + colGap, cy2);
      y += panelH + 7;
    } else {
      // Very long list — single column, item by item, nothing ever cut.
      ensureSpace(8 + itemHs[0] + 2);
      sectionHeading("TERMS & CONDITIONS");
      let cy2 = y + 2;
      for (let i = 0; i < terms.length; i++) {
        if (cy2 + itemHs[i] > pageH - 8) {
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
    "I hereby accept the estimate as per above mentioned price and specifications.",
    contentW,
  ) as string[];
  // Exact block height: acceptance + gap + "For company" + line + label + thank-you.
  ensureSpace(accept.length * 4.5 + 26 + 10);
  doc.setTextColor(110, 110, 130);
  doc.text(accept, margin, y);
  y += accept.length * 4.5 + 14;

  const sigW = 62;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  doc.text(`For ${safe(settings.company.name)}`, pageW - margin, y - 2, { align: "right" });

  y += 8;
  doc.setDrawColor(...DARK_MID);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + sigW, y);
  doc.line(pageW - margin - sigW, y, pageW - margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 140);
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

  // ── PAGE FOOTER ────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Footer bar (slim)
    doc.setFillColor(...DARK);
    doc.rect(0, pageH - 6, pageW, 6, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(180, 185, 210);
    // Baseline chosen so 7pt text sits optically centered in the 6mm bar.
    const footY = pageH - 1.8;
    doc.text(safe(quote.number), margin, footY);
    doc.text(safe(settings.company.name), pageW / 2, footY, { align: "center" });
    doc.text(`Page ${i} of ${total}`, pageW - margin, footY, { align: "right" });
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
