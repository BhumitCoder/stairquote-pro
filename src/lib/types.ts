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

// Built-in values have dedicated calc formulas; any other string falls back to
// the generic  qty × measureValue × rate  formula (same as sqft/rft).
export type RateMode = string;
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

// ============ Bills / Invoices ============
export type InvoiceStatus = "Unpaid" | "Partial" | "Paid";
export type PaymentMode = "Cash" | "UPI" | "Bank Transfer" | "Cheque";

export interface Payment {
  id: string;
  date: number; // ms
  amount: number;
  mode: PaymentMode;
  note?: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: number; // ms
  status: InvoiceStatus; // derived from payments
  clientId: string;
  clientSnapshot: Client;
  quotationId?: string;
  quotationNumber?: string;
  items: QuoteItem[];
  discount: Discount;
  gstPercent: number;
  subTotal: number;
  discountAmt: number;
  gstAmt: number;
  grandTotal: number;
  totals: { area: number; weight: number; itemCount: number };
  payments: Payment[];
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface BankDetails {
  accountName: string;
  bankName: string;
  branch: string;
  accountNo: string;
  ifsc: string;
  upiId: string;
}

export interface CompanyProfile {
  name: string;
  address: string;
  phones: string;
  email: string;
  website: string;
  gst: string;
  salesPerson: string;
  stampUrl?: string; // company stamp/seal shown in the signature area
  stampPath?: string;
}

export interface AppSettings {
  company: CompanyProfile;
  bank: BankDetails; // printed on bills only
  termsAndConditions: string[];
  gstPercent: number;
  currency: string;
  quotePrefix: string;
  invoicePrefix: string;
  docTitle: "Estimate" | "Quotation";
  loadingNotice: string;
  dropdowns: {
    stairTypes: string[];
    materials: string[];
    units: string[];
    rateBasis: string[];
  };
}
