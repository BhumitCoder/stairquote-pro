import type { AppSettings, RateMode } from "./types";

// Brand constants — fixed parts of the Vastu Stairs Designer identity
// (vastustairdesigner.com), used across the app, auth screen and PDF.
export const BRAND_TAGLINE = "Staircases that define luxury";

// All rate-basis modes the app knows how to calculate. Settings can enable/disable
// and reorder which of these show up in the "Rate Basis" dropdown, but the set of
// possible values is fixed here because each one drives a specific calc.ts formula.
export const RATE_BASIS_ALL: RateMode[] = ["sqft", "rft", "step", "lumpsum"];

export const RATE_BASIS_LABELS: Record<RateMode, string> = {
  sqft: "₹ / sqft",
  rft: "₹ / rft",
  step: "₹ / step",
  lumpsum: "Lump Sum",
};

export const DEFAULT_SETTINGS: AppSettings = {
  company: {
    name: "Vastu Stairs Designer",
    // Written with exactly 3 commas — the PDF/preview header shows one line per comma part.
    address:
      "Shed No. 13 Krishna Compound, Ashwini Kumar Road, Near Bhavani Circle, Surat Gujarat 395008",
    phones: "+91 88665 44441, +91 98252 90311",
    email: "info@vastustairdesigner.com",
    website: "www.vastustairdesigner.com",
    gst: "",
    salesPerson: "",
  },
  bank: {
    accountName: "",
    bankName: "",
    branch: "",
    accountNo: "",
    ifsc: "",
    upiId: "",
  },
  termsAndConditions: [
    "18% GST applies on subtotal.",
    "Final billing as per actual site measurement.",
    "Site should provide power for hand tools.",
    "Installation within 30 days after advance received.",
    "This rate is valid for 15 days.",
    "Dimensions to be verified by client/architect; changes will affect pricing.",
    "No warranty on glass once installed.",
    "Client must report manufacturing defects within 2 days of installation.",
  ],
  gstPercent: 18,
  currency: "₹",
  quotePrefix: "Q",
  invoicePrefix: "INV",
  docTitle: "Estimate",
  loadingNotice: "LOADING, UNLOADING & TRANSPORTATION EXTRA AS PER ACTUAL.",
  dropdowns: {
    stairTypes: [
      "Square Staircase",
      "Round Staircase",
      "Spiral Staircase",
      "Helical Staircase",
      "Steel Staircase",
      "Cantilever Metal Staircase",
      "Floating / Hanging Staircase",
      "SS Glass Stair Railing",
      "Balcony SS Glass Railing",
      "Handrail",
      "SS Swing Gate",
      "SS Sliding Gate (Automatic)",
      "SS Safety Gate",
      "Mild Steel Gate",
      "Metal Structure Fabrication",
      "PVD Coated Railing",
      "Metal Furniture",
      "Custom",
    ],
    materials: [
      "Mild Steel (MS)",
      "SS 304",
      "SS 316",
      "Glass + SS",
      "Glass + MS",
      "PVD Coated SS",
      "Wood",
      "Aluminium",
      "Custom",
    ],
    units: ["sqft", "rft"],
    rateBasis: RATE_BASIS_ALL,
  },
};
