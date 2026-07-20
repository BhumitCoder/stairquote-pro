import { useLayoutEffect, useRef, useState } from "react";

// The document layout (QuotationPreview) is designed for a fixed content
// width — the same width the PDF is captured at. On narrow (mobile) screens
// we shrink the whole page to fit via a CSS transform instead of letting it
// wrap into a distorted column or forcing a horizontal scrollbar, so it always
// reads like a real A4 sheet, just smaller.
const DOC_WIDTH = 680;

export function ScaledDocumentPreview({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [docHeight, setDocHeight] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      setScale(outer.clientWidth / DOC_WIDTH);
      setDocHeight(inner.scrollHeight);
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  });

  return (
    <div
      ref={outerRef}
      className="mx-auto w-full max-w-[860px] overflow-hidden rounded-lg border bg-muted/10"
    >
      <div style={{ height: docHeight * scale || undefined }}>
        <div
          ref={innerRef}
          style={{ width: DOC_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
