export function formatRupiah(value, { compact = false } = {}) {
  const n = Number(value) || 0;
  if (compact) {
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
    return `Rp ${n}`;
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

export const TODAY = new Date("2026-04-25T00:00:00");

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function diffDays(a, b) {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

export function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function dateInRange(date, start, end) {
  const t = startOfDay(date).getTime();
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime();
}
