// src/lib/settle.ts
// Turns ledger balances into the fewest payments that settle everyone: the biggest debtor pays the
// biggest creditor, repeat. Shared by the dashboard hero and the expenses page.
import type { Balance } from '@/types';

export interface PlannedPayment {
  from: string;
  fromName: string;
  fromAvatar: string | null;
  to: string;
  toName: string;
  toAvatar: string | null;
  amount: number;
}

const EPSILON = 0.005;

export function planPayments(balances: Balance[]): PlannedPayment[] {
  const working = balances.map((b) => ({ ...b }));
  const payments: PlannedPayment[] = [];
  for (let guard = 0; guard < 100; guard += 1) {
    const debtor = working.filter((b) => b.net < -EPSILON).sort((a, b) => a.net - b.net)[0];
    const creditor = working.filter((b) => b.net > EPSILON).sort((a, b) => b.net - a.net)[0];
    if (!debtor || !creditor) break;
    const amount = Math.round(Math.min(-debtor.net, creditor.net) * 100) / 100;
    payments.push({
      from: debtor.userId,
      fromName: debtor.userName,
      fromAvatar: debtor.avatar,
      to: creditor.userId,
      toName: creditor.userName,
      toAvatar: creditor.avatar,
      amount,
    });
    debtor.net = Math.round((debtor.net + amount) * 100) / 100;
    creditor.net = Math.round((creditor.net - amount) * 100) / 100;
  }
  return payments;
}

/** One sentence for a planned payment, from the viewer's point of view. */
export function describePayment(payment: PlannedPayment, currentUserId: string, format: (amount: number) => string): string {
  if (payment.from === currentUserId) return `You owe ${payment.toName} ${format(payment.amount)}`;
  if (payment.to === currentUserId) return `${payment.fromName} owes you ${format(payment.amount)}`;
  return `${payment.fromName} owes ${payment.toName} ${format(payment.amount)}`;
}
