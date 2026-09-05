import { describe, expect, it } from 'vitest';
import { splitByPercentage, splitEqually, splitsMatchTotal, sumSplits } from '@/lib/splits';

const ids = ['a', 'b', 'c'];

describe('splitEqually', () => {
  it('divides evenly when possible', () => {
    expect(splitEqually(30, ids)).toEqual({ a: 10, b: 10, c: 10 });
  });

  it('never loses or invents a cent', () => {
    for (const total of [10, 0.01, 0.02, 100.01, 33.33, 1234.56, 0.1 + 0.2]) {
      const split = splitEqually(total, ids);
      expect(sumSplits(ids, split)).toBe(Math.round(total * 100) / 100);
      const cents = Object.values(split).map((v) => Math.round(v * 100));
      expect(Math.max(...cents) - Math.min(...cents)).toBeLessThanOrEqual(1);
    }
  });

  it('returns nothing for nobody', () => {
    expect(splitEqually(10, [])).toEqual({});
  });
});

describe('splitByPercentage', () => {
  it('rounds every share to cents and lands exactly on the total', () => {
    const split = splitByPercentage(100, ids, { a: 33.33, b: 33.33, c: 33.34 });
    expect(split).toEqual({ a: 33.33, b: 33.33, c: 33.34 });
    expect(sumSplits(ids, split)).toBe(100);
  });

  it('gives the rounding remainder to the last person', () => {
    const split = splitByPercentage(10, ids, { a: 33.333, b: 33.333, c: 33.334 });
    expect(split.a).toBe(3.33);
    expect(split.b).toBe(3.33);
    expect(split.c).toBe(3.34);
  });

  it('treats missing percentages as zero', () => {
    expect(splitByPercentage(20, ['a', 'b'], { a: 100 })).toEqual({ a: 20, b: 0 });
  });
});

describe('splitsMatchTotal', () => {
  it('accepts sub-cent float noise', () => {
    expect(splitsMatchTotal(0.3, ['a', 'b'], { a: 0.1, b: 0.2 })).toBe(true);
  });

  it('rejects a real mismatch', () => {
    expect(splitsMatchTotal(10, ['a', 'b'], { a: 5, b: 4.99 })).toBe(false);
  });
});
