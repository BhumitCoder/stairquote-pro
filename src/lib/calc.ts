import type { Discount, QuoteItem, Quotation } from "./types";

// Round to 2 decimals so every line and total on the PDF adds up exactly.
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeItemAmount(item: QuoteItem): number {
  if (item.rateMode === "lumpsum") return round2(item.qty * item.rate);
  return round2(item.qty * item.measureValue * item.rate);
}

export function recomputeQuotation(
  q: Omit<Quotation, "subTotal" | "discountAmt" | "gstAmt" | "grandTotal" | "totals">,
): Quotation {
  const items = q.items.map((it) => ({ ...it, amount: computeItemAmount(it) }));
  const subTotal = round2(items.reduce((s, it) => s + it.amount, 0));
  const gstPercent = clampPercent(q.gstPercent);
  const discountAmt = calcDiscount(subTotal, q.discount);
  const taxable = round2(subTotal - discountAmt);
  const gstAmt = round2((taxable * gstPercent) / 100);
  const grandTotal = round2(taxable + gstAmt);
  const area = round2(
    items.reduce((s, it) => s + (it.rateMode === "lumpsum" ? 0 : it.measureValue * it.qty), 0),
  );
  const weight = round2(items.reduce((s, it) => s + (it.weight ?? 0) * it.qty, 0));
  return {
    ...q,
    items,
    gstPercent,
    subTotal,
    discountAmt,
    gstAmt,
    grandTotal,
    totals: { area, weight, itemCount: items.length },
  };
}

// A discount can never exceed the subtotal (or 100%) — otherwise the grand total goes negative.
export function calcDiscount(subTotal: number, d: Discount): number {
  if (!d || !d.value || d.value <= 0) return 0;
  if (d.mode === "percent") return round2((subTotal * clampPercent(d.value)) / 100);
  return round2(Math.min(d.value, subTotal));
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100);
}

// Next free item code (S01, S02, …) — duplicating/deleting items must never produce collisions.
export function nextItemCode(items: QuoteItem[]): string {
  const max = items.reduce((m, it) => {
    const n = Number(/^S(\d+)$/.exec(it.code)?.[1] ?? 0);
    return Math.max(m, n);
  }, 0);
  return `S${String(max + 1).padStart(2, "0")}`;
}

export function blankItem(code = "S01"): QuoteItem {
  return {
    code,
    name: "",
    location: "",
    material: "",
    finish: "",
    specs: [],
    qty: 1,
    rateMode: "sqft",
    rate: 0,
    measureUnit: "sqft",
    measureValue: 0,
    amount: 0,
  };
}
