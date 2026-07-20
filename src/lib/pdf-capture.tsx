import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { urlToDataUrl } from "./storage";

// ─── PDF = exact copy of the on-screen preview ───────────────────────────────
// The preview component is rendered off-screen at a fixed A4-friendly width,
// captured with html2canvas at ~290 DPI and split into A4 pages. Page breaks
// are LAYOUT-AWARE: sections marked with [data-block] are never sliced in half
// — a break happens between blocks, with proper margins on continuation pages.
// Every page gets the centered logo watermark.

const A4_W = 210; // mm
const A4_H = 297; // mm
const RENDER_W = 820; // CSS px — layout width the preview is rendered at
const SCALE = 3; // capture scale → 2460px wide ≈ 290 DPI on A4
const PAD_TOP_MM = 10; // top margin on continuation pages
const PAD_BOTTOM_MM = 9; // breathing room kept at the bottom of every page

// Mobile browsers (mobile Safari in particular) enforce much stricter canvas
// size/memory ceilings than desktop — historically as low as ~4096px on a
// single dimension. The whole document is captured as ONE tall canvas before
// being sliced into pages, so a long document at full SCALE can land right at
// that ceiling; content near the bottom (signatures/stamp) is what silently
// gets clipped or corrupted first. We detect this ahead of time and back off
// the capture scale just enough to stay safely under the limit, rather than
// always assuming desktop-level headroom.
const MAX_CANVAS_DIMENSION = 4096;

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.src = src;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
    });
    return img;
  } catch {
    return null;
  }
}

/** Wait until every <img> inside the node has finished loading (or failed). */
async function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          }),
    ),
  );
}

/** Fallback for blocks taller than a page: nearest all-white row above `ideal`. */
function whiteScanCut(
  ctx: CanvasRenderingContext2D,
  width: number,
  sy: number,
  ideal: number,
): number {
  const scan = Math.min(Math.floor((ideal - sy) * 0.25), ideal - sy - 10);
  if (scan <= 0) return ideal;
  try {
    const region = ctx.getImageData(0, ideal - scan, width, scan);
    const data = region.data;
    for (let r = scan - 1; r >= 0; r--) {
      let clean = true;
      const rowStart = r * width * 4;
      for (let x = 0; x < width; x += 12) {
        const i = rowStart + x * 4;
        if (data[i] < 244 || data[i + 1] < 244 || data[i + 2] < 244) {
          clean = false;
          break;
        }
      }
      if (clean) return ideal - (scan - 1 - r);
    }
  } catch {
    // tainted canvas — hard cut
  }
  return ideal;
}

async function captureToPdf(el: HTMLElement, blockTopsCss: number[]): Promise<Blob> {
  try {
    await document.fonts.ready;
  } catch {
    // older browsers — proceed anyway
  }

  const rect = el.getBoundingClientRect();
  const safeScale = Math.min(
    SCALE,
    MAX_CANVAS_DIMENSION / Math.max(rect.width, 1),
    MAX_CANVAS_DIMENSION / Math.max(rect.height, 1),
  );

  const canvas = await html2canvas(el, {
    scale: safeScale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: RENDER_W,
    onclone: (docClone) => {
      // The watermark is stamped per-page afterwards — hide the single DOM one.
      docClone.querySelectorAll<HTMLElement>("[data-watermark]").forEach((n) => {
        n.style.display = "none";
      });
    },
  });

  const w = canvas.width;
  const pxPerCss = w / el.getBoundingClientRect().width;
  const blockTops = blockTopsCss
    .map((t) => Math.round(t * pxPerCss))
    .filter((t) => t > 0)
    .sort((a, b) => a - b);

  const pageHpx = Math.floor((w * A4_H) / A4_W);
  const padTop = Math.floor((w * PAD_TOP_MM) / A4_W);
  const padBottom = Math.floor((w * PAD_BOTTOM_MM) / A4_W);
  const srcCtx = canvas.getContext("2d");

  const logoUrl = await urlToDataUrl("/logo.png");
  const logoImg = logoUrl ? await loadImage(logoUrl) : null;

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  // The closing block (signatures + thank-you + footer) is the LAST [data-block]
  // — on the final page it is pinned to the absolute bottom edge, so the red
  // rule always closes the sheet like real letterhead.
  const closingTop = blockTops.length > 0 ? blockTops[blockTops.length - 1] : null;
  const closingH = closingTop != null ? canvas.height - closingTop : 0;

  const drawWatermark = (ctx: CanvasRenderingContext2D) => {
    if (logoImg && logoImg.naturalWidth > 0) {
      const wmW = w * 0.5;
      const wmH = (wmW * logoImg.naturalHeight) / logoImg.naturalWidth;
      ctx.globalAlpha = 0.05;
      ctx.drawImage(logoImg, (w - wmW) / 2, (pageHpx - wmH) / 2, wmW, wmH);
      ctx.globalAlpha = 1;
    }
  };

  // Fit-to-page: when the document only *barely* overflows one page (the
  // signature block spilling over), shrink the whole capture up to 12% so it
  // fits a single page — invisible at ~290 DPI, and far more professional
  // than a near-empty second page.
  const cap1 = pageHpx - padBottom;
  if (canvas.height > cap1 && canvas.height * 0.88 <= cap1) {
    const s = cap1 / canvas.height;
    const destW = Math.floor(w * s);
    const destX = Math.floor((w - destW) / 2);
    const page = document.createElement("canvas");
    page.width = w;
    page.height = pageHpx;
    const ctx = page.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, pageHpx);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (closingTop != null && closingTop > 0) {
        // Content at the top, closing block pinned to the page bottom.
        const topH = Math.floor(closingTop * s);
        const closeH = Math.floor(closingH * s);
        ctx.drawImage(canvas, 0, 0, w, closingTop, destX, 0, destW, topH);
        ctx.drawImage(
          canvas,
          0,
          closingTop,
          w,
          closingH,
          destX,
          Math.max(pageHpx - closeH, topH),
          destW,
          closeH,
        );
      } else {
        ctx.drawImage(
          canvas,
          0,
          0,
          w,
          canvas.height,
          destX,
          0,
          destW,
          Math.floor(canvas.height * s),
        );
      }
      drawWatermark(ctx);
      doc.addImage(page.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, A4_W, A4_H);
      return doc.output("blob");
    }
  }

  let sy = 0;
  let pageIndex = 0;
  while (sy < canvas.height) {
    const offsetY = pageIndex === 0 ? 0 : padTop; // continuation pages get a top margin
    const capacity = pageHpx - offsetY - padBottom;
    let end = Math.min(sy + capacity, canvas.height);

    if (end < canvas.height) {
      // Prefer a break BETWEEN blocks: the lowest block top that fits this page
      // (but never leave a page less than a third full).
      // IMPORTANT: Never break at closingTop itself — that would isolate the
      // closing block alone on the final page and create a blank-page gap when
      // it is pinned to the bottom. Keeping the closing block anchored to
      // whatever non-closing content precedes it on the final page is correct.
      const candidates = blockTops.filter(
        (t) => t > sy + capacity * 0.33 && t <= end && t !== closingTop,
      );
      if (candidates.length > 0) {
        end = candidates[candidates.length - 1];
      } else if (srcCtx) {
        end = whiteScanCut(srcCtx, w, sy, end);
      }
    }

    const sliceH = end - sy;
    const page = document.createElement("canvas");
    page.width = w;
    page.height = pageHpx;
    const ctx = page.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, pageHpx);

    const isLastPage = end >= canvas.height;
    if (isLastPage && closingTop != null && closingTop >= sy) {
      // Final page: content at the top, closing block pinned to the bottom edge.
      const topH = closingTop - sy;
      if (topH > 0) ctx.drawImage(canvas, 0, sy, w, topH, 0, offsetY, w, topH);
      // Safety: if topH == 0 the closing block is the only content on this page
      // (can happen via whiteScanCut). Pin-to-bottom would leave a full blank
      // page above it, so instead draw it naturally from the top margin.
      const closeY =
        topH > 0 ? Math.max(pageHpx - closingH, offsetY + topH) : offsetY;
      ctx.drawImage(canvas, 0, closingTop, w, closingH, 0, closeY, w, closingH);
    } else {
      ctx.drawImage(canvas, 0, sy, w, sliceH, 0, offsetY, w, sliceH);
    }

    drawWatermark(ctx);

    if (pageIndex > 0) doc.addPage();
    doc.addImage(page.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, A4_W, A4_H);

    sy = end;
    pageIndex++;
  }

  return doc.output("blob");
}

/**
 * Render a React element (the live QuotationPreview) off-screen and convert it
 * into a pixel-identical, high-resolution A4 PDF with block-aware page breaks.
 */
export async function renderPreviewToPdf(element: ReactElement): Promise<Blob> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${RENDER_W}px`;
  host.style.zIndex = "-1";
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    // Two RAFs: one for React to commit, one for layout/paint to settle.
    await new Promise<void>((res) => {
      root.render(<div data-pdf-root>{element}</div>);
      requestAnimationFrame(() => requestAnimationFrame(() => res()));
    });
    await waitForImages(host);
    // Images may change layout — let it settle once more.
    await new Promise<void>((res) => requestAnimationFrame(() => res()));

    const target = host.querySelector<HTMLElement>("[data-pdf-root]");
    if (!target) throw new Error("Preview failed to render");

    // Measure section boundaries (CSS px, relative to the captured root).
    const rootTop = target.getBoundingClientRect().top;
    const blockTops = Array.from(target.querySelectorAll<HTMLElement>("[data-block]")).map(
      (b) => b.getBoundingClientRect().top - rootTop,
    );

    return await captureToPdf(target, blockTops);
  } finally {
    root.unmount();
    host.remove();
  }
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
