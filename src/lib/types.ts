export interface Client {
  id: string;
  name: string;
  org?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  createdAt?: number;
  callbackDate?: number; // ms — next follow-up/callback reminder
  callbackNote?: string;
}

export type RateMode = "sqft" | "rft" | "lumpsum";
export type MeasureUnit = "sqft" | "rft";

export interface QuoteItem {
  code: string;
  name: string;
  location?: string;
  imageUrl?: string;
  imagePath?: string;
  material?: string;
  finish?: string;
  width?: number; // mm
  height?: number; // mm
  steps?: number;
  measureUnit: MeasureUnit;
  measureValue: number; // sqft or rft per unit qty
  specs: string[];
  qty: number;
  rateMode: RateMode;
  rate: number;
  amount: number;
  weight?: number; // kg per unit
}

export type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Rejected";

export interface Discount {
  mode: "percent" | "amount";
  value: number;
}

export interface Quotation {
  id: string;
  number: string;
  date: number; // ms
  status: QuoteStatus;
  clientId: string;
  clientSnapshot: Client;
  items: QuoteItem[];
  discount: Discount;
  gstPercent: number;
  subTotal: number;
  discountAmt: number;
  gstAmt: number;
  grandTotal: number;
  totals: { area: number; weight: number; itemCount: number };
  notes?: string;
  pdfUrl?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface CompanyProfile {
  name: string;
  address: string;
  phones: string;
  email: string;
  website: string;
  gst: string;
  salesPerson: string;
}

export interface AppSettings {
  company: CompanyProfile;
  paymentTerms: string;
  termsAndConditions: string[];
  gstPercent: number;
  currency: string;
  quotePrefix: string;
  docTitle: "Estimate" | "Quotation";
  loadingNotice: string;
  dropdowns: {
    stairTypes: string[];
    materials: string[];
    units: string[];
  };
}
