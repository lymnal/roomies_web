// src/components/expenses/PaymentMatrix.tsx
// Ledger balances per member plus the smallest set of payments that settles everyone up.
'use client';

import { useMemo, useState } from 'react';
import { HiOutlineArrowRight, HiOutlineCheck, HiOutlineScale } from 'react-icons/hi2';
import { errorMessage } from '@/lib/api-client';
import { recordSettlement } from '@/lib/services/expenses';
import { describePayment, planPayments, type PlannedPayment } from '@/lib/settle';
import { cn, formatCurrency } from '@/lib/utils';
import type { Balance } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Confirm';
import EmptyState from '@/components/ui/EmptyState';
import Segmented from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';

interface PaymentMatrixProps {
  householdId: string;
  balances: Balance[];
  currentUserId: string;
  initialView?: 'summary' | 'plan';
  onSettled?: () => void | Promise<void>;
}

export default function PaymentMatrix({ householdId, balances, currentUserId, initialView = 'summary', onSettled }: PaymentMatrixProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<'summary' | 'plan'>(initialView);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const plan = useMemo(() => planPayments(balances), [balances]);
  const sorted = useMemo(() => [...balances].sort((a, b) => b.net - a.net), [balances]);
  const maxAbs = useMemo(() => balances.reduce((max, b) => Math.max(max, Math.abs(b.net)), 0), [balances]);

  const markPaid = async (payment: PlannedPayment) => {
    const iPay = payment.from === currentUserId;
    const ok = await confirm({
      title: 'Record this payment?',
      description: iPay
        ? `You paid ${payment.toName} ${formatCurrency(payment.amount)} outside the app (cash, bank transfer, Venmo…).`
        : `${payment.fromName} paid you ${formatCurrency(payment.amount)} outside the app.`,
      confirmLabel: 'Record payment',
    });
    if (!ok) return;
    const key = `${payment.from}-${payment.to}`;
    setBusyKey(key);
    try {
      await recordSettlement({ householdId, fromUserId: payment.from, toUserId: payment.to, amount: payment.amount, description: 'Settled up' });
      toast.success('Payment recorded', iPay ? `You paid ${payment.toName} ${formatCurrency(payment.amount)}` : `${payment.fromName} paid you ${formatCurrency(payment.amount)}`);
      await onSettled?.();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to record payment'));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Card
      title="Balances"
      description="Straight from the ledger"
      actions={
        <Segmented
          size="sm"
          ariaLabel="Balance view"
          value={view}
          onChange={setView}
          options={[
            { value: 'summary', label: 'Overview' },
            { value: 'plan', label: 'Settle up', count: plan.length > 0 ? plan.length : undefined },
          ]}
        />
      }
      noPadding
    >
      {balances.length === 0 ? (
        <EmptyState compact icon={<HiOutlineScale className="h-6 w-6" />} title="No balances yet" description="Add an expense and this fills in." />
      ) : view === 'summary' ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((balance) => {
            const isMe = balance.userId === currentUserId;
            const positive = balance.net > 0.004;
            const negative = balance.net < -0.004;
            const width = maxAbs > 0 && (positive || negative) ? Math.max(6, Math.round((Math.abs(balance.net) / maxAbs) * 100)) : 0;
            return (
              <li key={balance.userId} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar src={balance.avatar} name={balance.userName} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{isMe ? 'You' : balance.userName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{positive ? (isMe ? 'are owed' : 'is owed') : negative ? (isMe ? 'owe' : 'owes') : 'settled up'}</p>
                  </div>
                  <p className={cn('text-sm font-semibold tabular-nums', positive ? 'text-emerald-600 dark:text-emerald-400' : negative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400')}>
                    {positive ? `+${formatCurrency(balance.net)}` : negative ? `−${formatCurrency(-balance.net)}` : formatCurrency(0)}
                  </p>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={cn('h-full rounded-full transition-all duration-500', positive ? 'bg-emerald-500' : negative ? 'bg-rose-500' : 'bg-transparent')} style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : plan.length === 0 ? (
        <EmptyState compact icon={<HiOutlineCheck className="h-6 w-6" />} title="Everyone is settled up" description="No payments needed right now." />
      ) : (
        <div className="p-4 sm:p-5">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            {plan.length === 1 ? 'One payment clears every balance.' : `${plan.length} payments clear every balance.`}
          </p>
          <ul className="space-y-2">
            {plan.map((payment) => {
              const key = `${payment.from}-${payment.to}`;
              const involvesMe = payment.from === currentUserId || payment.to === currentUserId;
              const iPay = payment.from === currentUserId;
              return (
                <li
                  key={key}
                  className={cn('rounded-xl border p-3', involvesMe ? 'border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-800')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-shrink-0 items-center">
                      <Avatar src={payment.fromAvatar} name={payment.fromName} size={28} />
                      <HiOutlineArrowRight className="mx-1 h-4 w-4 text-slate-400" />
                      <Avatar src={payment.toAvatar} name={payment.toName} size={28} />
                    </div>
                    <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">{describePayment(payment, currentUserId, formatCurrency)}</p>
                  </div>
                  {involvesMe && (
                    <Button size="sm" fullWidth variant={iPay ? 'primary' : 'outline'} className="mt-3" isLoading={busyKey === key} onClick={() => void markPaid(payment)} leftIcon={<HiOutlineCheck className="h-4 w-4" />}>
                      {iPay ? 'I paid this' : 'I received this'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
