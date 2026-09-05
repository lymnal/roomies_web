// src/lib/utils.ts

/** Currency formatting (USD for now; the app has no per-household currency yet). */
export function formatCurrency(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(value) ? value : 0
  );
}

/** Parse "YYYY-MM-DD" as a local date (not UTC midnight) so it doesn't shift a day in the US. */
export function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
}

/** Format an ISO timestamp or a date-only string for display. */
export function formatDate(date: Date | string | null | undefined, includeTime = false): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? parseDate(date) : date;
  if (Number.isNaN(dateObj.getTime())) return '';
  return includeTime ? dateObj.toLocaleString() : dateObj.toLocaleDateString();
}

/** Today's date as YYYY-MM-DD in local time (for <input type="date">). */
export function todayISODate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** ISO timestamp → YYYY-MM-DD (local) for date inputs. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? parseDate(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function initials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function truncate(str: string, length: number): string {
  return str.length <= length ? str : `${str.slice(0, length)}...`;
}
