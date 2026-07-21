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

// Per-page crop capture: renders ONLY the given CSS slice of the element.
// Capturing each page separately (instead of one giant canvas) keeps every
// canvas well under mobile memory caps, so each page renders at full DPI —
// this is what makes the output genuinely sharp on phones.
async function capturePage(
  el: HTMLElement,
  yCss: number,
  hCss: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: RENDER_W,
    windowHeight: Math.ceil(el.scrollHeight),
    x: 0,
    y: yCss,
    width: RENDER_W,
    height: Math.ceil(hCss),
    scrollX: 0,
    scrollY: 0,
  });
}

async function captureToPdf(el: HTMLElement, blockTopsCss: number[]): Promise<Blob> {
  try {
    await document.fonts.ready;
  } catch {
    // older browsers — proceed anyway
  }

  // Full A4 page height, in the element's CSS pixels.
  const PAGE_CSS = RENDER_W * (A4_H / A4_W);
  const padTopCss = RENDER_W * (PAD_TOP_MM / A4_W);
  const padBottomCss = RENDER_W * (PAD_BOTTOM_MM / A4_W);
  const totalCss = Math.max(el.scrollHeight, el.getBoundingClientRect().height, 1);

  const blockTops = blockTopsCss.filter((t) => t > 0).sort((a, b) => a - b);
  const closingTopCss = blockTops.length > 0 ? blockTops[blockTops.length - 1] : null;

  // Per-PAGE resolution: a single A4 page at SCALE stays well under mobile
  // canvas ceilings (unlike the whole document at once), so we keep full DPI.
  const scale = Math.min(
    SCALE,
    MAX_CANVAS_DIMENSION / RENDER_W,
    MAX_CANVAS_DIMENSION / PAGE_CSS,
    Math.sqrt(MAX_CANVAS_AREA / (RENDER_W * PAGE_CSS)),
  );
  const wPx = Math.round(RENDER_W * scale);
  const pageHpx = Math.round(PAGE_CSS * scale);

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

  // ── Single page (incl. fit-to-page for a barely-overflowing document) ──────
  const cap1Css = PAGE_CSS - padBottomCss;
  if (totalCss <= cap1Css / 0.88) {
    const { c, ctx } = newPageCanvas();
    if (totalCss > cap1Css) {
      // Barely over — scale the whole thing down a hair to fill one page; the
      // closing block ends at the bottom naturally.
      const slice = await capturePage(el, 0, totalCss, scale);
      const s = cap1Css / totalCss;
      const destW = Math.round(wPx * s);
      const destH = Math.round(slice.height * s);
      ctx.drawImage(
        slice,
        0,
        0,
        slice.width,
        slice.height,
        Math.round((wPx - destW) / 2),
        0,
        destW,
        destH,
      );
    } else if (closingTopCss != null && closingTopCss > 40) {
      // Comfortably fits: content at the top, and the closing block (signatures
      // + stamp + thank-you + footer + red rule) pinned to the very bottom edge
      // (bottom: 0) — the professional letterhead look.
      const topSlice = await capturePage(el, 0, closingTopCss, scale);
      ctx.drawImage(topSlice, 0, 0);
      const closeSlice = await capturePage(el, closingTopCss, totalCss - closingTopCss, scale);
      const closeY = Math.max(pageHpx - closeSlice.height, topSlice.height);
      ctx.drawImage(closeSlice, 0, closeY);
    } else {
      const slice = await capturePage(el, 0, totalCss, scale);
      ctx.drawImage(slice, 0, 0);
    }
    drawWatermark(ctx);
    doc.addImage(c.toDataURL("image/png"), "PNG", 0, 0, A4_W, A4_H);
    return doc.output("blob");
  }

  // ── Plan page breaks in CSS, landing only on [data-block] boundaries ───────
  const pages: { s: number; e: number }[] = [];
  let s = 0;
  let idx = 0;
  while (s < totalCss - 1) {
    const offTopCss = idx === 0 ? 0 : padTopCss;
    const capCss = PAGE_CSS - offTopCss - padBottomCss;
    let e = Math.min(s + capCss, totalCss);
    if (e < totalCss) {
      const candidates = blockTops.filter((t) => t > s + 40 && t <= e);
      if (candidates.length > 0) e = candidates[candidates.length - 1];
    }
    // Safety: a page break must NEVER land inside the closing block (signatures
    // + stamp + footer). If it would, snap the break up to the closing block's
    // top so the whole closing block moves intact to the final page.
    if (closingTopCss != null && e > closingTopCss && e < totalCss && closingTopCss > s + 40) {
      e = closingTopCss;
    }
    pages.push({ s, e });
    s = e;
    idx++;
  }

  for (let p = 0; p < pages.length; p++) {
    const { s: startCss, e: endCss } = pages[p];
    const offTopPx = p === 0 ? 0 : Math.round(padTopCss * scale);
    const { c, ctx } = newPageCanvas();

    // On the final page, the closing block (thank-you + footer + red rule) is
    // pinned to the very bottom edge — like a formal contract. This covers both
    // cases: the closing block sharing the last page with other content, AND
    // the last page consisting only of the closing block.
    const isLast = p === pages.length - 1;
    const closeStartCss = closingTopCss != null ? Math.max(closingTopCss, startCss) : null;
    const pinClosing = isLast && closeStartCss != null && closeStartCss < endCss - 2;

    if (pinClosing) {
      const topHcss = closeStartCss! - startCss;
      let topBottomPx = offTopPx;
      if (topHcss > 2) {
        const topSlice = await capturePage(el, startCss, topHcss, scale);
        ctx.drawImage(topSlice, 0, offTopPx);
        topBottomPx = offTopPx + topSlice.height;
      }
      const closeSlice = await capturePage(el, closeStartCss!, endCss - closeStartCss!, scale);
      const closeY = Math.max(pageHpx - closeSlice.height, topBottomPx);
      ctx.drawImage(closeSlice, 0, closeY);
    } else {
      const slice = await capturePage(el, startCss, endCss - startCss, scale);
      ctx.drawImage(slice, 0, offTopPx);
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
