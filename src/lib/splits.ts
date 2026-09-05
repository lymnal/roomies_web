// src/lib/splits.ts
// Cent-exact split arithmetic shared by the expense form (and tested in isolation).
import { roundCents } from '@/lib/utils';

/** Split `total` across `ids` so the parts sum to the total exactly; the first people absorb the odd cents. */
export function splitEqually(total: number, ids: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  if (ids.length === 0) return result;
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / ids.length);
  let remainder = cents - base * ids.length;
  ids.forEach((id) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    result[id] = (base + extra) / 100;
  });
  return result;
}

/** Percentage split; the last person absorbs rounding so the parts sum to the total exactly. */
export function splitByPercentage(total: number, ids: string[], percentages: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  if (ids.length === 0) return result;
  let allocated = 0;
  ids.forEach((id, index) => {
    if (index === ids.length - 1) {
      result[id] = roundCents(total - allocated);
    } else {
      const amount = roundCents((total * (percentages[id] ?? 0)) / 100);
      result[id] = amount;
      allocated = roundCents(allocated + amount);
    }
  });
  return result;
}

export function sumSplits(ids: string[], amounts: Record<string, number>): number {
  return roundCents(ids.reduce((sum, id) => sum + (amounts[id] ?? 0), 0));
}

/** True when the shares of `ids` add up to `total` within half a cent. */
export function splitsMatchTotal(total: number, ids: string[], amounts: Record<string, number>): boolean {
  return Math.abs(sumSplits(ids, amounts) - roundCents(total)) < 0.005;
}
