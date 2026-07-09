import type { Discount, QuoteItem, Quotation } from "./types";

export function computeItemAmount(item: QuoteItem): number {
  if (item.rateMode === "lumpsum") return item.qty * item.rate;
  return item.qty * item.measureValue * item.rate;
}

export function recomputeQuotation(
  q: Omit<Quotation, "subTotal" | "discountAmt" | "gstAmt" | "grandTotal" | "totals">,
): Quotation {
  const items = q.items.map((it) => ({ ...it, amount: computeItemAmount(it) }));
  const subTotal = items.reduce((s, it) => s + it.amount, 0);
  const discountAmt = calcDiscount(subTotal, q.discount);
  const taxable = subTotal - discountAmt;
  const gstAmt = (taxable * q.gstPercent) / 100;
  const grandTotal = taxable + gstAmt;
  const area = items.reduce(
    (s, it) => s + (it.rateMode === "lumpsum" ? 0 : it.measureValue * it.qty),
    0,
  );
  const weight = items.reduce((s, it) => s + (it.weight ?? 0) * it.qty, 0);
  return {
    ...q,
    items,
    subTotal,
    discountAmt,
    gstAmt,
    grandTotal,
    totals: { area, weight, itemCount: items.length },
  };
}

export function calcDiscount(subTotal: number, d: Discount): number {
  if (!d || !d.value) return 0;
  if (d.mode === "percent") return (subTotal * d.value) / 100;
  return d.value;
}

export function blankItem(nextIndex: number): QuoteItem {
  return {
    code: `S${String(nextIndex).padStart(2, "0")}`,
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
