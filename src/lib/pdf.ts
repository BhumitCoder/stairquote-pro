import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import type { AppSettings, Quotation } from "./types";
import { formatINR, formatNum, formatDate } from "./format";
import { urlToDataUrl } from "./storage";

const RED: [number, number, number] = [232, 72, 77];
const DARK: [number, number, number] = [40, 40, 45];
const LIGHT: [number, number, number] = [245, 245, 247];

interface ImageCache {
  [url: string]: string | null;
}

const APP_LOGO_URL = "/logo.png";

async function loadImages(quote: Quotation, settings: AppSettings): Promise<ImageCache> {
  const cache: ImageCache = {};
  const urls = new Set<string>();
  if (settings.company.logoUrl) urls.add(settings.company.logoUrl);
  urls.add(APP_LOGO_URL); // always load brand logo as fallback
  for (const it of quote.items) if (it.imageUrl) urls.add(it.imageUrl);
  await Promise.all(
    [...urls].map(async (u) => {
      cache[u] = await urlToDataUrl(u);
    }),
  );
  return cache;
}

export async function generateQuotationPdf(
  quote: Quotation,
  settings: AppSettings,
): Promise<Blob> {
  const images = await loadImages(quote, settings);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  // ---------- HEADER ----------
  const headerH = 42;
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.3);
  // Outer header frame
  doc.rect(margin, margin, pageW - margin * 2, headerH);
  // Split header into left (company) and right (client)
  const midX = pageW / 2;
  doc.line(midX, margin, midX, margin + headerH);

  // Company block (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...RED);
  doc.text(settings.company.name || "Company Name", margin + 3, margin + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  const compLines = [
    settings.company.address,
    settings.company.phones && `Ph: ${settings.company.phones}`,
    settings.company.email && `Email: ${settings.company.email}`,
    settings.company.website && `Web: ${settings.company.website}`,
    settings.company.gst && `GSTIN: ${settings.company.gst}`,
  ].filter(Boolean) as string[];
  let cy = margin + 11;
  for (const line of compLines) {
    const wrapped = doc.splitTextToSize(line, midX - margin - 6);
    doc.text(wrapped, margin + 3, cy);
    cy += wrapped.length * 4;
  }

  // Right block: logo top-right + client
  const rightX = midX + 3;
  const rightW = pageW - margin - midX - 3;
  // Logo top-right — use company logo, or fall back to brand logo
  const logoData =
    (settings.company.logoUrl && images[settings.company.logoUrl]) ||
    images[APP_LOGO_URL];
  if (logoData) {
    try {
      // Dark background pill behind the logo
      doc.setFillColor(21, 21, 32);
      doc.roundedRect(pageW - margin - 42, margin + 1, 40, 18, 2, 2, "F");
      doc.addImage(logoData, "PNG", pageW - margin - 41, margin + 2, 38, 16, undefined, "FAST");
    } catch {
      // ignore
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("To,", rightX, margin + 6);
  doc.setFontSize(11);
  doc.text(quote.clientSnapshot.name, rightX, margin + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const clientLines = [
    quote.clientSnapshot.org,
    quote.clientSnapshot.address,
    [quote.clientSnapshot.city, quote.clientSnapshot.state].filter(Boolean).join(", "),
    quote.clientSnapshot.phone && `Mobile: ${quote.clientSnapshot.phone}`,
    quote.clientSnapshot.email && `Email: ${quote.clientSnapshot.email}`,
  ].filter(Boolean) as string[];
  let ry = margin + 15;
  for (const line of clientLines) {
    const wrapped = doc.splitTextToSize(line, rightW - 32);
    doc.text(wrapped, rightX, ry);
    ry += wrapped.length * 4;
  }
  // Quote meta bottom-right of header
  doc.setFontSize(9);
  doc.text(`Quote No: ${quote.number}`, pageW - margin - 3, margin + headerH - 10, {
    align: "right",
  });
  doc.text(`Date: ${formatDate(quote.date)}`, pageW - margin - 3, margin + headerH - 6, {
    align: "right",
  });
  if (settings.company.salesPerson) {
    doc.text(
      `Sales: ${settings.company.salesPerson}`,
      pageW - margin - 3,
      margin + headerH - 2,
      { align: "right" },
    );
  }

  // ---------- TITLE ----------
  const titleY = margin + headerH + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...RED);
  doc.text(settings.docTitle.toUpperCase(), pageW / 2, titleY, { align: "center" });
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.7);
  doc.line(pageW / 2 - 22, titleY + 1.5, pageW / 2 + 22, titleY + 1.5);

  // ---------- ITEMS TABLE ----------
  const rowImgHeight = 26; // mm allocated for images
  const body = quote.items.map((it, idx) => {
    const detailLines: string[] = [];
    detailLines.push(`[${it.code}] ${it.name}`);
    if (it.location) detailLines.push(`Location: ${it.location}`);
    const mf = [it.material, it.finish].filter(Boolean).join(" • ");
    if (mf) detailLines.push(mf);
    if (it.steps) detailLines.push(`Steps: ${it.steps}`);
    for (const s of it.specs) if (s.trim()) detailLines.push(`• ${s}`);
    if (it.weight) detailLines.push(`Weight: ${formatNum(it.weight, 2)} Kg`);
    return [
      String(idx + 1),
      { content: detailLines.join("\n"), _img: it.imageUrl },
      it.width ? String(it.width) : "-",
      it.height ? String(it.height) : "-",
      String(it.qty),
      it.rateMode === "lumpsum" ? "-" : formatNum(it.measureValue * it.qty, 2),
      it.rateMode === "lumpsum" ? "Lump" : formatNum(it.rate, 2),
      formatNum(it.amount, 2),
    ];
  });

  autoTable(doc, {
    startY: titleY + 5,
    head: [
      ["#", "Details", "Width", "Height", "Qty", "Sqft/Rft", "Rate (Rs.)", "Amount (Rs.)"],
    ],
    body: body as never,
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: DARK,
      lineWidth: 0.15,
      textColor: DARK,
      valign: "top",
    },
    headStyles: {
      fillColor: RED,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 78 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 28, halign: "right" },
    },
    didParseCell: (data) => {
      // If details cell has an image, reserve minimum height so the image fits
      if (data.section === "body" && data.column.index === 1) {
        const raw = data.cell.raw as { _img?: string } | undefined;
        if (raw && raw._img && images[raw._img]) {
          data.cell.styles.minCellHeight = rowImgHeight + 6;
          // Shift text right of image
          (data.cell.styles as unknown as { cellPadding: unknown }).cellPadding = {
            top: 2,
            right: 2,
            bottom: 2,
            left: 30,
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
              26,
              rowImgHeight,
              undefined,
              "FAST",
            );
          } catch {
            // ignore
          }
        }
      }
    },
    didDrawPage: () => {
      // page footer drawn later after totals
    },
  });

  // ---------- SUM ROW ----------
  interface JsPdfWithAt extends jsPDF {
    lastAutoTable?: { finalY: number };
  }
  let y = (doc as JsPdfWithAt).lastAutoTable?.finalY ?? titleY + 20;
  y += 3;

  const sumRow = [
    ["", "TOTAL", "", "", String(quote.totals.itemCount), formatNum(quote.totals.area, 2), "", formatNum(quote.subTotal, 2)],
  ];
  autoTable(doc, {
    startY: y,
    body: sumRow,
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2,
      lineColor: DARK,
      lineWidth: 0.15,
      textColor: DARK,
      fontStyle: "bold",
      fillColor: LIGHT,
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 78 },
      2: { cellWidth: 15 },
      3: { cellWidth: 15 },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 20 },
      7: { cellWidth: 28, halign: "right" },
    },
  });
  y = (doc as JsPdfWithAt).lastAutoTable?.finalY ?? y + 8;

  // ---------- BOTTOM: BANK (left) & TOTALS (right) ----------
  y += 3;
  const boxTop = y;
  const leftW = (pageW - margin * 2) * 0.55;
  const rightW2 = (pageW - margin * 2) * 0.45;
  const rightX2 = margin + leftW;

  // Left summary + bank
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.2);
  const leftLines = [
    `Total Items: ${quote.totals.itemCount}`,
    `Total Area: ${formatNum(quote.totals.area, 2)}`,
    `Total Weight: ${formatNum(quote.totals.weight, 2)} Kg`,
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  let ly = boxTop + 5;
  for (const l of leftLines) {
    doc.text(l, margin + 2, ly);
    ly += 4.5;
  }
  ly += 2;
  doc.setTextColor(...RED);
  doc.text("Company's Bank Details", margin + 2, ly);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  ly += 4.5;
  const bankLines = [
    settings.bank.accountName && `A/C Name: ${settings.bank.accountName}`,
    settings.bank.bankName && `Bank: ${settings.bank.bankName}`,
    settings.bank.branch && `Branch: ${settings.bank.branch}`,
    settings.bank.accountNo && `A/C No: ${settings.bank.accountNo}`,
    settings.bank.ifsc && `IFSC: ${settings.bank.ifsc}`,
  ].filter(Boolean) as string[];
  for (const l of bankLines) {
    doc.text(l, margin + 2, ly);
    ly += 4;
  }

  // Right totals box
  const rows: [string, string][] = [
    ["Sub Total", formatNum(quote.subTotal, 2)],
    [
      `Discount ${quote.discount.mode === "percent" ? `(${quote.discount.value}%)` : ""}`,
      `- ${formatNum(quote.discountAmt, 2)}`,
    ],
    [`GST @ ${quote.gstPercent}%`, formatNum(quote.gstAmt, 2)],
  ];
  const rowH = 6;
  let ty = boxTop;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const [k, v] of rows) {
    doc.rect(rightX2, ty, rightW2, rowH);
    doc.text(k, rightX2 + 2, ty + 4);
    doc.text(v, rightX2 + rightW2 - 2, ty + 4, { align: "right" });
    ty += rowH;
  }
  // Grand total highlighted
  doc.setFillColor(...RED);
  doc.rect(rightX2, ty, rightW2, rowH + 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Grand Total", rightX2 + 2, ty + 4.5);
  doc.text(formatINR(quote.grandTotal), rightX2 + rightW2 - 2, ty + 4.5, {
    align: "right",
  });
  ty += rowH + 1;
  // Avg rate
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const avg = quote.totals.area > 0 ? quote.grandTotal / quote.totals.area : 0;
  doc.rect(rightX2, ty, rightW2, rowH);
  doc.text("Avg Price / sqft", rightX2 + 2, ty + 4);
  doc.text(formatNum(avg, 2), rightX2 + rightW2 - 2, ty + 4, { align: "right" });
  ty += rowH;

  y = Math.max(ly, ty) + 5;

  // Ensure enough space; add page if needed
  const ensureSpace = (need: number) => {
    if (y + need > pageH - 20) {
      doc.addPage();
      y = margin + 5;
    }
  };

  // ---------- NOTICE ----------
  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...RED);
  doc.text(`● ${settings.loadingNotice}`, margin, y);
  y += 6;

  // ---------- PAYMENT TERMS ----------
  ensureSpace(20);
  doc.setTextColor(...DARK);
  doc.text("PAYMENT TERMS", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const ptLines = doc.splitTextToSize(settings.paymentTerms, pageW - margin * 2);
  ensureSpace(ptLines.length * 4 + 4);
  doc.text(ptLines, margin, y);
  y += ptLines.length * 4 + 3;

  // ---------- T&C ----------
  ensureSpace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TERMS & CONDITIONS", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  settings.termsAndConditions.forEach((t, i) => {
    const wrapped = doc.splitTextToSize(`${i + 1}. ${t}`, pageW - margin * 2);
    ensureSpace(wrapped.length * 4 + 1);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4;
  });
  y += 3;

  // ---------- ACCEPTANCE + SIGNATURES ----------
  ensureSpace(30);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  const accept = doc.splitTextToSize(
    "I hereby accept the estimate as per above mentioned price and specifications.",
    pageW - margin * 2,
  );
  doc.text(accept, margin, y);
  y += accept.length * 4 + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.line(margin, y, margin + 60, y);
  doc.line(pageW - margin - 60, y, pageW - margin, y);
  doc.text("Authorized Signatory", margin, y + 4);
  doc.text("Signature of Customer", pageW - margin, y + 4, { align: "right" });

  // ---------- PAGE FOOTER: "Page X of Y" ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 5, { align: "right" });
    doc.text(quote.number, margin, pageH - 5);
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
