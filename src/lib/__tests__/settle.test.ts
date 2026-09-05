import { describe, expect, it } from 'vitest';
import { describePayment, planPayments } from '@/lib/settle';
import type { Balance } from '@/types';

const balance = (userId: string, net: number): Balance => ({ userId, userName: userId, avatar: null, net, owes: 0, isOwed: 0 });

describe('planPayments', () => {
  it('returns nothing when everyone is settled', () => {
    expect(planPayments([balance('a', 0), balance('b', 0.004)])).toEqual([]);
  });

  it('pairs the biggest debtor with the biggest creditor and clears every balance', () => {
    const plan = planPayments([balance('a', 60), balance('b', -40), balance('c', -20)]);
    expect(plan).toEqual([
      expect.objectContaining({ from: 'b', to: 'a', amount: 40 }),
      expect.objectContaining({ from: 'c', to: 'a', amount: 20 }),
    ]);
    const totalPaid = plan.reduce((sum, p) => sum + p.amount, 0);
    expect(totalPaid).toBe(60);
  });

  it('splits one debt across creditors and keeps cents exact', () => {
    const plan = planPayments([balance('a', 33.33), balance('b', 33.34), balance('c', -66.67)]);
    expect(plan.map((p) => p.amount)).toEqual([33.34, 33.33]);
    expect(plan.every((p) => p.from === 'c')).toBe(true);
  });

  it('does not mutate its input', () => {
    const input = [balance('a', 10), balance('b', -10)];
    planPayments(input);
    expect(input[0].net).toBe(10);
  });
});

describe('describePayment', () => {
  const payment = { from: 'me', fromName: 'Me', fromAvatar: null, to: 'sam', toName: 'Sam', toAvatar: null, amount: 12.5 };
  const format = (n: number) => `$${n.toFixed(2)}`;

  it('speaks from the viewer’s point of view', () => {
    expect(describePayment(payment, 'me', format)).toBe('You owe Sam $12.50');
    expect(describePayment(payment, 'sam', format)).toBe('Me owes you $12.50');
    expect(describePayment(payment, 'other', format)).toBe('Me owes Sam $12.50');
  });
});
