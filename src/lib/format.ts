// Indian number formatting: 8,45,184.93
export function formatINR(n: number, withSymbol = true): string {
  if (!Number.isFinite(n)) n = 0;
  const s = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return withSymbol ? `₹ ${s}` : s;
}

export function formatNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) n = 0;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function isToday(ms: number): boolean {
  return isSameDay(ms, Date.now());
}

export function isOverdue(ms: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return ms < today.getTime() && !isToday(ms);
}

export function todayKey(d = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}
