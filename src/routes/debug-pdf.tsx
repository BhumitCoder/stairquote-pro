import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { renderPreviewToPdf } from "@/lib/pdf-capture";
import { QuotationPreview } from "@/components/QuotationPreview";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import type { Quotation } from "@/lib/types";

export const Route = createFileRoute("/debug-pdf")({
  ssr: false,
  component: DebugPdf,
});

const mockQuote: Quotation = {
  id: "1",
  number: "Q-00001",
  date: new Date(2026, 6, 9).getTime(),
  status: "Sent",
  clientId: "c1",
  clientSnapshot: {
    id: "c1",
    name: "Divyeshbhai",
    org: "",
    phone: "+91 79907 65122",
    email: "",
    address: "Katargam",
    city: "Surat",
    state: "Gujarat",
  },
  items: [
    {
      code: "1",
      name: "L-Shape Staircase",
      location: "Surat",
      material: "MS Steel",
      finish: "Metal Primer",
      measureUnit: "sqft",
      measureValue: 0,
      specs: ["Handrail included", "Anti-skid coating"],
      qty: 20,
      rateMode: "lumpsum",
      rate: 0,
      amount: 230000,
      steps: 20,
      weight: 120,
      imageUrl: "/logo.png",
    },
  ],
  discount: { mode: "percent", value: 0 },
  gstPercent: 18,
  subTotal: 230000,
  discountAmt: 0,
  gstAmt: 41400,
  grandTotal: 271400,
  totals: { area: 12.5, weight: 40, itemCount: 1 },
};

function DebugPdf() {
  const [mode, setMode] = useState<"preview" | "pdf">("pdf");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    renderPreviewToPdf(
      <QuotationPreview
        quote={mockQuote}
        settings={{ ...DEFAULT_SETTINGS, docTitle: "Quotation" }}
      />,
    )
      .then((blob) => {
        setUrl(URL.createObjectURL(blob));
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? `${e.message}\n${e.stack}` : String(e));
      });
  }, []);
  return (
    <div>
      <div className="flex gap-2 p-2">
        <button onClick={() => setMode("preview")} className="border px-2 py-1">
          Preview
        </button>
        <button onClick={() => setMode("pdf")} className="border px-2 py-1">
          PDF
        </button>
      </div>
      {mode === "preview" && (
        <QuotationPreview
          quote={mockQuote}
          settings={{ ...DEFAULT_SETTINGS, docTitle: "Quotation" }}
        />
      )}
      {mode === "pdf" &&
        (error ? (
          <pre className="whitespace-pre-wrap p-8 text-red-600">{error}</pre>
        ) : url ? (
          <iframe src={url} className="h-screen w-full" title="pdf" />
        ) : (
          <div className="p-8">Generating...</div>
        ))}
    </div>
  );
}
