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
// size/memory ceilings than desktop. Two separate limits apply:
//   • Single-dimension cap: historically as low as 2048 px on older iOS,
//     4096 px on modern iOS/Android.
//   • Total-area cap: iOS Safari caps canvas memory at ~16 MP; older/budget
//     Android devices can be as low as ~8 MP.
// The whole document is captured as ONE tall canvas before being sliced into
// pages, so a long document can hit either ceiling; content near the bottom
// (signatures/stamp) is what silently gets clipped or corrupted first.
// We use 3000 px as the single-dimension cap (well below 4096) and 9 MP as
// the area cap so both constraints are satisfied across all common devices.
// Each PAGE is captured on its own now (not the whole document at once), so a
// single canvas is only ~one A4 page — these ceilings comfortably allow full
// ~300 DPI per page on modern phones without hitting memory limits.
const MAX_CANVAS_DIMENSION = 4096;
const MAX_CANVAS_AREA = 11_000_000; // ~11 MP — one A4 page at 300 DPI ≈ 8.6 MP

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

async function captureToPdf(el: HTMLElement, blockTopsCss: number[]): Promise<Blob> {
  try {
    await document.fonts.ready;
  } catch {
    // older browsers — proceed anyway
  }

  const totalCss = Math.max(el.scrollHeight, el.getBoundingClientRect().height, 1);

  // Capture the WHOLE document as ONE master canvas, then slice pages from it by
  // exact pixel rows. This is deterministic — every page (and the bottom-pinned
  // closing block) is drawn from the same pixels, so a stamp/line can NEVER be
  // duplicated or offset (which multiple separate screenshots risked on mobile).
  const scale = Math.min(
    SCALE,
    MAX_CANVAS_DIMENSION / RENDER_W,
    MAX_CANVAS_DIMENSION / totalCss,
    Math.sqrt(MAX_CANVAS_AREA / (RENDER_W * totalCss)),
  );
  const master = await html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: RENDER_W,
    windowHeight: Math.ceil(totalCss),
    scrollX: 0,
    scrollY: 0,
  });

  const wPx = master.width;
  const pxPerCss = wPx / RENDER_W;
  const pageHpx = Math.round(wPx * (A4_H / A4_W));
  const padTopPx = Math.round((PAD_TOP_MM / A4_W) * wPx);
  const padBottomPx = Math.round((PAD_BOTTOM_MM / A4_W) * wPx);
  const masterH = master.height;

  const blockTopsPx = blockTopsCss
    .filter((t) => t > 0)
    .map((t) => Math.round(t * pxPerCss))
    .sort((a, b) => a - b);
  const closingPx = blockTopsPx.length > 0 ? blockTopsPx[blockTopsPx.length - 1] : null;

  const logoUrl = await urlToDataUrl("/logo.png");
  const logoImg = logoUrl ? await loadImage(logoUrl) : null;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  const drawWatermark = (ctx: CanvasRenderingContext2D) => {
    if (logoImg && logoImg.naturalWidth > 0) {
      const wmW = wPx * 0.5;
      const wmH = (wmW * logoImg.naturalHeight) / logoImg.naturalWidth;
      ctx.globalAlpha = 0.05;
      ctx.drawImage(logoImg, (wPx - wmW) / 2, (pageHpx - wmH) / 2, wmW, wmH);
      ctx.globalAlpha = 1;
    }
  };

  const newPageCanvas = () => {
    const c = document.createElement("canvas");
    c.width = wPx;
    c.height = pageHpx;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, wPx, pageHpx);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return { c, ctx };
  };

  // Slice a horizontal band [syPx, syPx+hPx] out of the master onto ctx at dstY.
  const drawBand = (ctx: CanvasRenderingContext2D, syPx: number, hPx: number, dstY: number) => {
    if (hPx <= 0) return;
    ctx.drawImage(master, 0, syPx, wPx, hPx, 0, dstY, wPx, hPx);
  };

  // ── Single page (incl. fit-to-page for a barely-overflowing document) ──────
  const cap1Px = pageHpx - padBottomPx;
  if (masterH <= cap1Px / 0.88) {
    const { c, ctx } = newPageCanvas();
    if (masterH > cap1Px) {
      // Barely over — scale the whole thing down a hair to fill one page.
      const sc = cap1Px / masterH;
      const destW = Math.round(wPx * sc);
      const destH = Math.round(masterH * sc);
      ctx.drawImage(master, 0, 0, wPx, masterH, Math.round((wPx - destW) / 2), 0, destW, destH);
    } else if (closingPx != null && closingPx > 40) {
      // Content at the top; closing block pinned to the very bottom edge.
      drawBand(ctx, 0, closingPx, 0);
      const closeH = masterH - closingPx;
      drawBand(ctx, closingPx, closeH, Math.max(pageHpx - closeH, closingPx));
    } else {
      drawBand(ctx, 0, masterH, 0);
    }
    drawWatermark(ctx);
    doc.addImage(c.toDataURL("image/png"), "PNG", 0, 0, A4_W, A4_H);
    return doc.output("blob");
  }

  // ── Plan page breaks in master px, landing only on [data-block] boundaries ──
  const pages: { s: number; e: number }[] = [];
  let s = 0;
  let idx = 0;
  const gap = Math.round(40 * pxPerCss);
  while (s < masterH - 1) {
    const offTop = idx === 0 ? 0 : padTopPx;
    const cap = pageHpx - offTop - padBottomPx;
    let e = Math.min(s + cap, masterH);
    if (e < masterH) {
      const candidates = blockTopsPx.filter((t) => t > s + gap && t <= e);
      if (candidates.length > 0) e = candidates[candidates.length - 1];
    }
    // A break must NEVER land inside the closing block — snap up to its top so
    // the whole closing block moves intact to the final page.
    if (closingPx != null && e > closingPx && e < masterH && closingPx > s + gap) {
      e = closingPx;
    }
    pages.push({ s, e });
    s = e;
    idx++;
  }

  for (let p = 0; p < pages.length; p++) {
    const { s: startPx, e: endPx } = pages[p];
    const offTop = p === 0 ? 0 : padTopPx;
    const { c, ctx } = newPageCanvas();

    const isLast = p === pages.length - 1;
    const closeStart = closingPx != null ? Math.max(closingPx, startPx) : null;
    const pinClosing = isLast && closeStart != null && closeStart < endPx - 2;

    if (pinClosing) {
      // Final page: content at the top, closing block pinned to the bottom edge.
      const topH = closeStart! - startPx;
      if (topH > 2) drawBand(ctx, startPx, topH, offTop);
      const closeH = endPx - closeStart!;
      const closeY = Math.max(pageHpx - closeH, offTop + Math.max(topH, 0));
      drawBand(ctx, closeStart!, closeH, closeY);
    } else {
      drawBand(ctx, startPx, endPx - startPx, offTop);
    }

    drawWatermark(ctx);
    if (p > 0) doc.addPage();
    doc.addImage(c.toDataURL("image/png"), "PNG", 0, 0, A4_W, A4_H);
  }

  return doc.output("blob");
}

/**
 * Render a React element (the live QuotationPreview) off-screen and convert it
 * into a pixel-identical, high-resolution A4 PDF with block-aware page breaks.
 */
export async function renderPreviewToPdf(element: ReactElement): Promise<Blob> {
  const host = document.createElement("div");
  // Place the off-screen host at a fixed position that mobile browsers will
  // still fully layout and paint. left:-10000px is too extreme — iOS Safari
  // can skip layout/compositing for elements that far outside the viewport,
  // making getBoundingClientRect() return 0 for height and causing the
  // canvas to be captured at the wrong scale.
  // Using left:0 / top:0 with a CSS translateX push keeps the element in the
  // browser's "near-viewport" zone so layout is always computed correctly.
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.transform = `translateX(${RENDER_W + 100}px)`;
  host.style.width = `${RENDER_W}px`;
  host.style.zIndex = "-9999";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);
  const root = createRoot(host);

  // Lock the window at the top while capturing. html2canvas maps the off-screen
  // element against the window scroll position; if the page is scrolled (mobile
  // Download button is low on the page), content gets duplicated/offset. We
  // restore the exact scroll position afterwards so the user sees no jump.
  const prevScrollX = window.scrollX;
  const prevScrollY = window.scrollY;
  const prevScrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);

  try {
    // Two RAFs: one for React to commit, one for layout/paint to settle.
    await new Promise<void>((res) => {
      root.render(<div data-pdf-root>{element}</div>);
      requestAnimationFrame(() => requestAnimationFrame(() => res()));
    });
    await waitForImages(host);

    // ── Fix 1: watermark ────────────────────────────────────────────────────
    // Remove the DOM watermark element entirely before html2canvas clones the
    // tree. Using display:none proved unreliable on some mobile WebKit builds;
    // physically removing the node is bulletproof. The per-page watermark is
    // drawn separately via drawWatermark() on each canvas page.
    host.querySelectorAll<HTMLElement>("[data-watermark]").forEach((n) => n.remove());

    // ── Fix 2: ContainImage explicit dimensions ─────────────────────────────
    // html2canvas ignores CSS `max-width`/`max-height` and can also ignore
    // `overflow:hidden` on flex containers, causing stamp images to render at
    // their full natural resolution and bleed outside the box.
    //
    // ContainImage stores the intended box size in data-box-w/data-box-h
    // attributes so we can compute explicit px dimensions here WITHOUT relying
    // on clientWidth/clientHeight — those return 0 for off-screen elements on
    // mobile, which was what made the old approach ineffective.
    host.querySelectorAll<HTMLElement>("[data-contain-box]").forEach((container) => {
      const boxW = parseFloat(container.dataset.boxW ?? "0");
      const boxH = parseFloat(container.dataset.boxH ?? "0");
      if (!boxW || !boxH) return;
      const img = container.querySelector<HTMLImageElement>("img");
      if (!img || !img.naturalWidth || !img.naturalHeight) return;
      const ratio = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
      img.style.width = `${Math.round(img.naturalWidth * ratio)}px`;
      img.style.height = `${Math.round(img.naturalHeight * ratio)}px`;
      img.style.maxWidth = "";
      img.style.maxHeight = "";
      img.style.objectFit = ""; // clear any class-based object-fit
    });

    // Let React re-render (and any layout recalc) settle after the patches above.
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
    // Restore the user's scroll position — no visible jump.
    window.scrollTo(prevScrollX, prevScrollY);
    document.documentElement.style.scrollBehavior = prevScrollBehavior;
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
