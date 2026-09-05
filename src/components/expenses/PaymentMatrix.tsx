// src/components/expenses/PaymentMatrix.tsx
// Ledger balances per member plus the smallest set of payments that settles everyone up.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { fetchBalances, recordSettlement } from '@/lib/services/expenses';
import { formatCurrency } from '@/lib/utils';
import type { Balance } from '@/types';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';

interface PaymentMatrixProps {
  householdId: string;
  currentUserId: string;
  onSettled?: () => void;
}

interface PlannedPayment {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

/** Greedy pairing of the biggest debtor with the biggest creditor. */
function planPayments(balances: Balance[]): PlannedPayment[] {
  const working = balances.map((b) => ({ ...b }));
  const payments: PlannedPayment[] = [];
  const epsilon = 0.005;
  for (let guard = 0; guard < 100; guard += 1) {
    const debtor = working.filter((b) => b.net < -epsilon).sort((a, b) => a.net - b.net)[0];
    const creditor = working.filter((b) => b.net > epsilon).sort((a, b) => b.net - a.net)[0];
    if (!debtor || !creditor) break;
    const amount = Math.round(Math.min(-debtor.net, creditor.net) * 100) / 100;
    payments.push({ from: debtor.userId, fromName: debtor.userName, to: creditor.userId, toName: creditor.userName, amount });
    debtor.net = Math.round((debtor.net + amount) * 100) / 100;
    creditor.net = Math.round((creditor.net - amount) * 100) / 100;
  }
  return payments;
}

export default function PaymentMatrix({ householdId, currentUserId, onSettled }: PaymentMatrixProps) {
  const [view, setView] = useState<'summary' | 'plan'>('summary');
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setBalances(await fetchBalances(householdId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load balances'));
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const plan = useMemo(() => planPayments(balances), [balances]);

  const markPaid = async (payment: PlannedPayment) => {
    const label = payment.from === currentUserId ? `Record that you paid ${payment.toName} ${formatCurrency(payment.amount)}?` : `Record that ${payment.fromName} paid you ${formatCurrency(payment.amount)}?`;
    if (!window.confirm(label)) return;
    const key = `${payment.from}-${payment.to}`;
    setBusyKey(key);
    setError('');
    try {
      await recordSettlement({ householdId, fromUserId: payment.from, toUserId: payment.to, amount: payment.amount, description: 'Settled up' });
      await load();
      onSettled?.();
    } catch (err) {
      setError(errorMessage(err, 'Failed to record payment'));
    } finally {
      setBusyKey(null);
    }
  };

  const tabClass = (active: boolean, side: 'l' | 'r') =>
    `px-3 py-1 text-sm font-medium ${side === 'l' ? 'rounded-l-md' : 'rounded-r-md'} ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Balances</h3>
        <div className="flex">
          <button type="button" onClick={() => setView('summary')} className={tabClass(view === 'summary', 'l')}>
            Summary
          </button>
          <button type="button" onClick={() => setView('plan')} className={tabClass(view === 'plan', 'r')}>
            Settle up
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 pt-4">
          <Alert kind="error" onDismiss={() => setError('')}>
            {error}
          </Alert>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <Spinner />
        </div>
      ) : balances.length === 0 ? (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">Add an expense to see balances.</div>
      ) : view === 'summary' ? (
        <div className="px-4 py-5 sm:p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map((balance) => (
            <div key={balance.userId} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md flex items-center gap-3">
              <Avatar src={balance.avatar} name={balance.userName} size={40} />
              <div className="min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">{balance.userId === currentUserId ? 'You' : balance.userName}</div>
                <div className={`text-sm ${balance.net > 0 ? 'text-green-600 dark:text-green-400' : balance.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {balance.net > 0 ? `is owed ${formatCurrency(balance.net)}` : balance.net < 0 ? `owes ${formatCurrency(-balance.net)}` : 'settled up'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-5 sm:p-6">
          {plan.length === 0 ? (
            <p className="text-center text-gray-700 dark:text-gray-300">Everyone is settled up.</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Fewest payments that settle every balance:</p>
              <ul className="space-y-2">
                {plan.map((payment) => {
                  const involvesMe = payment.from === currentUserId || payment.to === currentUserId;
                  const key = `${payment.from}-${payment.to}`;
                  return (
                    <li key={key} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md flex items-center justify-between gap-3">
                      <div className="text-sm text-gray-900 dark:text-white">
                        <span className="font-medium">{payment.from === currentUserId ? 'You' : payment.fromName}</span> → <span className="font-medium">{payment.to === currentUserId ? 'you' : payment.toName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(payment.amount)}</span>
                        {involvesMe && (
                          <button
                            type="button"
                            disabled={busyKey === key}
                            onClick={() => void markPaid(payment)}
                            className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs rounded-md hover:bg-green-200 dark:hover:bg-green-800 disabled:opacity-50"
                          >
                            {busyKey === key ? 'Saving…' : 'Mark paid'}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
