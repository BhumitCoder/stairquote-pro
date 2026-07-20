import type { AppSettings, RateMode } from "./types";

// Brand constants — fixed parts of the Vastu Stairs Designer identity
// (vastustairdesigner.com), used across the app, auth screen and PDF.
export const BRAND_TAGLINE = "Staircases that define luxury";

// ── Document font options (admin-selectable, applied to quotation/bill PDFs) ──
export const DOC_FONT_OPTIONS = [
  {
    value: "playfair",
    label: "Playfair Display",
    description: "Classic elegant serif — default",
    css: '"Playfair Display", Georgia, "Times New Roman", serif',
  },
  {
    value: "samsung-one",
    label: "SamsungOne-400",
    description: "Option 1 — clean modern sans",
    css: '"SamsungOne", "Arial Narrow", Arial, sans-serif',
  },
  {
    value: "arial-narrow",
    label: "Arial Narrow",
    description: "Option 2 — condensed precision",
    css: '"Arial Narrow", "Arial Nova Cond", Arial, sans-serif',
  },
] as const;

export type DocFontValue = (typeof DOC_FONT_OPTIONS)[number]["value"];

/** Returns the CSS font-family string for a given docFont setting value. */
export function getDocFontCss(docFont?: string): string {
  return (
    DOC_FONT_OPTIONS.find((o) => o.value === docFont)?.css ??
    DOC_FONT_OPTIONS[0].css
  );
}

// All rate-basis modes the app knows how to calculate. Settings can enable/disable
// and reorder which of these show up in the "Rate Basis" dropdown, but the set of
// possible values is fixed here because each one drives a specific calc.ts formula.
// The four built-in modes that have dedicated calc formulas.
export const RATE_BASIS_BUILTIN: string[] = ["sqft", "rft", "step", "lumpsum"];

// Default order shown when no setting has been saved yet.
export const RATE_BASIS_ALL: string[] = RATE_BASIS_BUILTIN;

// Human-readable label for built-in modes.
// For any custom mode (free text the user added), just show the value itself.
const BUILTIN_LABELS: Record<string, string> = {
  sqft: "₹ / sqft",
  rft: "₹ / rft",
  step: "₹ / step",
  lumpsum: "Lump Sum",
};
export function rateBasisLabel(mode: string): string {
  return BUILTIN_LABELS[mode] ?? mode;
}

// Keep old named export so existing imports don't break.
export const RATE_BASIS_LABELS = BUILTIN_LABELS;

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
    "Stone Fixing and Final Paint and Finishing, Wooden Fixing — client's vendor/arrangement.",
    "Manufacturing Time: 3–4 working weeks.",
    "All accessories such as bolts, nuts, washers, etc., include all Machinery, cutting, bending, grinding and labour, etc., complete.",
    "Rate Valid Only 3–5 Days.",
    "Scope of Work\n• Work will be executed strictly as per approved drawings and specifications.\n• Any modification or additional requirements requested after approval will be treated as extra work.",
    "Quotation Validity\n• This quotation remains valid for 15 days from the date of issue.\n• Prices may vary after the validity period due to material or market changes.",
    "Payment Terms\n• 70% Advance with Work Order.\n• 20% On completion of workshop fabrication.\n• 10% After full installation at site.\n• Payments must be released within 3 working days of invoice submission.",
    "Taxes & Duties\n• All taxes excluding GST (18%) are extra unless specified.\n• Any new government levy/tax during the project shall be borne by the client.",
    "Drawings & Approvals\n• All structural and architectural drawings must be approved by the client/consultant before fabrication.\n• Any delay in drawing approval will extend the project timeline.",
    "Material & Quality\n• All materials used will be as per grade and thickness mentioned in the quotation.\n• Brand of fasteners/anchoring may vary depending on site conditions.",
    "Timeline & Delays\n• Project timeline starts only after confirmation of design + advance payment.\n• Delays caused by civil work, site access, electricity, or third parties are not the contractor's responsibility.",
    "Site Conditions\n• Client must ensure clear access to the working area, availability of electrical power, safe working conditions, and civil readiness (beam, slab, wall, levels).",
    "Installation\n• Installation will be carried out using standard tools and procedures.\n• Any civil work, cutting, plaster repair, or painting is not included unless specified.",
    "Variations / Additional Work\n• Any change in size, design, finish, or specification will be billed separately.\n• Extra work will be executed only with written approval.",
    "Safety\n• Workers will follow standard safety protocols.\n• The client must ensure a hazard-free environment.",
    "Measurement & Final Amount\n• Final billing will be based on actual site measurements.\n• If quantities increase due to design changes, the cost will adjust accordingly.",
    "Cancellation\n• Order cancellation after fabrication begins will incur cost of fabricated materials + labour charges.",
    "Ownership\n• Material remains the contractor's property until full payment is received.",
    "Dispute Resolution\n• Any disputes will be addressed amicably.\n• If unresolved, they will fall under the jurisdiction of Surat courts.",
    "Labour Terms (Client Side)\n• Client must provide safe and clean working space with proper electricity and lighting.\n• Client must arrange material unloading support and helper labour for lifting heavy materials if needed.\n• Any civil work (cutting, breaking, plastering) must be arranged by the client.\n• Client must ensure site is ready before labour arrives.\n• Delay caused by client-side labour or site readiness will extend the timeline.\n• Damage caused by client-side labour is the client's responsibility.\n• Overtime charges apply if client requests extended working hours.\n• Accommodation and food for labour (if outstation) to be provided or reimbursed by the client.",
  ],
  gstPercent: 18,
  currency: "₹",
  quotePrefix: "Q",
  invoicePrefix: "INV",
  docTitle: "Estimate",
  docFont: "samsung-one",
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
